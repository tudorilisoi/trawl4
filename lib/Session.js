const sleep = require('sleep')
const _ = require('lodash')
const Q = require('q');
const ee = require('./eventBus');
const constants = require('./constants')
const util = require('./util')
const hash = require('./hash')
const Storage = require('./Storage');
const CrawlQueue = require('./CrawlQueue');
const Stats = require('./Stats');
const curl = require('./curl');
const html = require('./html');
const uritools = require('./uritools');

const robots = require('./robotstxt.js')

const LOG_PREFIX = 'SESSION'
const log = require('./logger').prefix(LOG_PREFIX);
const excludelog = require('./logger').prefix(LOG_PREFIX + ': EXCLUDED');
const errlog = require('./logger').error(LOG_PREFIX);

const FILTER_ALLOW_IMAGES = true;

function computeCrawlDelay(lastReqDate, crawlDelay) {
    let now = new Date().getTime()
    let last = lastReqDate.getTime();
    let elapsed = now - last;
    var ret = Math.max(crawlDelay - elapsed, 0)
    log('CRAWLDELAY', crawlDelay, ret)
    return ret

}

//these are raw URIs from the DOM, so make sure you normalize them
function getImageURIs(bodyHTML, selector, attr = 'src') {
    if (!selector) {
        return []
    }
    let imageLinks = html.bySelector(bodyHTML, selector, attr)

    log('IMAGES', imageLinks)
    return imageLinks
}

class Session {
    constructor(opts) {
        this.robotsParser = null; //see start()
        this.crawlDelay = opts.crawlDelay || constants.CRAWL_DELAY  //millis
        this.URIcounter = 0;
        this.opts = Object.assign({}, opts);

        //read the css selector
        this.imageSelector = util.deepProp(this.opts.parserClasses, 'recipe.chunks.images.cssSelector')


        this.timeout = null
        this.opts.domain = uritools.getBase(this.opts.domain)
        log('construct', this.opts)

        this.stats = new Stats(opts)

        this.storage = new Storage({
            domain: opts.domain
        })

        this.queue = new CrawlQueue({
            reset: opts.reset,
            mode: opts.mode,
            domain: opts.domain,
            storage: this.storage
        })

        ee.on(constants.EV_CRAWL_NEXT, this.crawlNextURI.bind(this));
        ee.on(constants.EV_SHUTDOWN, ()=> {
            clearTimeout(this.timeout)
        })

    }

    static sleep(seconds = 120) {
        log(`SLEEPING ${seconds} seconds`)
        sleep.sleep(seconds)
        ee.emit(constants.EV_CRAWL_NEXT)
    }

    static exitWithRestartCode() {
        ee.emit(constants.EV_STORAGE_REQUEST_DISCONNECT);
        process.exit(100)
    }

    stop() {
        //this.storage.disconnect();
        ee.emit(constants.QUEUE_FINISHED, this.uid)

        log('***FINISHED***')

        //TODO why does it not exit by itself?
        //hanging promises?
        process.exit(0)

    }

    matchesParser(relURI) {
        let reArr = util.deepProp(this.opts.parserClasses, 'recipe.includeRegexArr')
        let isMatch = reArr.some((re)=> {
            return !!re.test(relURI);
        })
        return isMatch
    }

    filterURI(uri, allowImages) {

        let baseURI = this.opts.domain
        let excludeArr = this.opts.excludeRegexArr
        let includeArr = this.opts.includeRegexArr

        let ret = uritools.normalize(uri, baseURI)

        if (ret === null) {
            return ret
        }

        if (!this.robotsParser.isAllowed(ret)) {
            excludelog('ROBOTS EXCLUDED', ret)
            return null
        }

        let relURI = uritools.getRelative(ret)


        if (allowImages) {
            //log('FILTER ALLOWS', relURI)
            return true
        }


        let isIncluded = includeArr.some((re)=> {
            return !!re.test(relURI);

        })

        if (!isIncluded) {
            //excludelog('CONF NOT INCLUDED', relURI)
            return null
        }

        let isExcluded = excludeArr.some((re)=> {
            if (re.test(relURI)) {
                excludelog('CONF EXCLUDED', relURI)
                return true
            }
            return null;
        })

        if (isExcluded) {
            return null
        }


        return ret
    }

    processCurlP(info) {
        let baseURI = uritools.getBase(info.uri)
        let relURI = uritools.getRelative(info.uri);

        //excluded
        if (info.skip) {
            return Q(true)
        }


        let links = html.getLinks(info.responseBody)
        let filter = this.filterURI.bind(this)
        let normLinks = links.map((l)=> {
                return filter(l)
            })
            .filter(l=>l !== null)


        //if it's a match, find images
        //TODO parse recipe as well
        let imageLinks = []
        if (this.matchesParser(
                relURI
            )
        ) {

            //filter won't let images through
            imageLinks = getImageURIs(info.responseBody, this.imageSelector)
            if (imageLinks[0]) {
                normLinks.push(
                    uritools.normalize(imageLinks[0], baseURI)
                )
            }
        }

        normLinks = _.uniq(normLinks);
        //log(links, normLinks)
        log(`FOUND ${normLinks.length}/${links.length} LINKS`)

        var records = normLinks.map((l)=> {
            //find opts and attribs in the same obj
            let ret = {
                __find: {hash: hash(l)},
                dateAdded: util.sqlDateTime(new Date()),
                domain: this.opts.domain,
                uri: l,
                state: constants.URI.STATUS_UNCRAWLED,
            }

            if (imageLinks.indexOf(l) !== -1) {
                log('PUSH IMAGE',
                    util.shortenString(relURI) + ' -> ' +
                    util.shortenString(uritools.getRelative(l)))
                ret.parentHash = hash(info.uri)
            }

            return ret

        })
        //log(records);
        return this.queue.push(records).then(()=> {
            log('PUSH DONE')
            return true;
        })
    }

    crawlNextURI(initial = false) {
        let stop = false;
        let self = this;

        let nextP;

        if (initial) {
            log('INITIAL URI')
            nextP = Q(
                //mimic a queue/curl response to kickstart the root URI
                {
                    uri: self.opts.startURI
                    || self.opts.domain
                })
        } else {
            nextP = this.queue.next();
        }

        let filterP = nextP.then((info)=> {
            //don't filter initial
            if (initial) {
                return info
            }
            //queue is empty
            if (!info) {
                stop = true;
                return;
            }
            let relURI = '.' + uritools.getRelative(info.uri)


            //regex/robot rules may have changed, so purge record if present
            //from a previous crawl

            // filter should allow images since we got this from queue so it was
            // explicitly pushed
            if (!self.filterURI(info.uri, FILTER_ALLOW_IMAGES)) {
                let removeP = self.queue.purge({
                    hash: hash(info.uri)
                })
                return removeP.then(()=> {
                    log('REMOVED EXCLUDED', relURI)
                    ee.emit(constants.EV_CRAWL_NEXT)
                    return 'SKIP'
                }).fail((err)=> {
                    errlog('FAILED TO DELETE', relURI, err, err.stack)
                    process.exit();
                })


            }
            return info;
        })


        let crawlP = filterP.then((info)=> {
            //filterP told us to do nothing
            if (info === 'SKIP') {
                return info;
            }
            //queue is empty
            if (!info) {
                stop = true;
                return;
            }
            let relURI = '.' + uritools.getRelative(info.uri)
            log('====> NEXT:', info ? relURI : 'NULL')
            log('FETCH URI', relURI)
            let mimetypes = constants.TEXT_MIME_TYPES.concat(constants.IMAGE_MIME_TYPES)
            return curl({
                acceptedMimeTypes: mimetypes,
                uri: info.uri
            });
        })

        crawlP.then((result)=> {

            //don't crawl since filterP skipped it
            if (result === 'SKIP') {
                return;
            }

            //queue empty
            if (stop) {
                return self.stop(self);
            }

            self.URIcounter++;

            //tell CrawlQueue to make it crawled
            //parse it
            //log('FETCH DONE', self.URIcounter, result)
            log(`FETCH COMPLETED [${result.code}] #` + self.URIcounter,
                uritools.getRelative(result.uri))

            let code = parseInt(result.code, 10)

            //http://www.w3.org/Protocols/rfc2616/rfc2616-sec10.html
            //bad gateway, service unavailable, gateway timeout
            if (code > 500) {
                log('SERVER ERROR')
                Session.sleep()
                return
            }

            if (_.endsWith(result.uri, '/')) {
                errlog(result)
                throw new Error('INVALID URI')
            }

            if (result.skip) {
                log('PARSER EXCLUDE/FETCH ERROR', result.reason, result.uri)
            }


            let fields = {
                httpStatus: result.code,
                mimeType: result.mimeType,
                headers: result.headers,
                duration: result.totalTime * 1000,
                dateLastCrawled: util.sqlDateTime(new Date()),
                excluded: result.skip ? 1 : 0,
                __find: {hash: hash(result.initialURI)},
                //the final uri may be different because of redirects
                uri: result.initialURI,
                domain: self.opts.domain,

            }
            if (util.isTextMime(result.mimeType)) {
                fields['response'] = result.responseBody
            } else {
                fields['binaryResponse'] = result.responseBody
            }
            log('MIME', result.mimeType)

            return self.queue.saveAndRemove(fields).then(
                ()=> {
                    log('SAVE DONE', uritools.getRelative(result.initialURI))

                    return self.processCurlP(result).then(()=> {

                        if (self.URIcounter > 0 &&
                            self.URIcounter % constants.URL_COUNT_FOR_RESTART === 0) {
                            Session.exitWithRestartCode()
                        }

                        if (global.gc && this.URIcounter % 10 === 0) {
                            log('***GC***')
                            global.gc()
                        }

                        log('SCHEDULE NEXT #' + (this.URIcounter + 1))

                        //this can cause infinite closures
                        //http://stackoverflow.com/questions/16072699/nodejs-settimeout-memory-leak


                        self.timeout = setTimeout(function () {
                            clearTimeout(self.timeout)
                            //self.crawlNextURI();
                            ee.emit(constants.EV_CRAWL_NEXT)
                        }, computeCrawlDelay(
                            result.dateCompleted, self.crawlDelay
                        ))
                        return true

                    })

                }
            ).fail((err)=> {
                errlog(err);
            })
            //.done();


        }).fail((err)=> {
                errlog('CRAWLER FAILED', err, err.stack);
                //errlog('CRAWLER FAILED', err);
                Session.sleep(120)
            })
            .done(()=> {
                //log('FETCH DONE', result.uri)
            });

    }

    start() {
        log('=>starting')
        var self = this;
        var robotsp = robots(
            constants.USER_AGENT,
            this.opts.domain)
        robotsp.then((parser)=> {
            //log(parser._parser.options)
            self.robotsParser = parser;
            self.crawlDelay = parser.getCrawlDelay() || self.crawlDelay
            log('crawl delay is', self.crawlDelay)
            ee.once(constants.EV_STORAGE_CONNECTED, ()=> {
                log('=>started')
                ee.emit(constants.EV_BOOT)
                this.crawlNextURI(true)
            })
            self.storage.connect();
        }).done();
    }
}

module.exports = Session