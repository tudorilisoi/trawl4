const sleep = require('sleep')
const _ = require('lodash')
const beep = require('beepbeep')
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
const sitemaps = require('sitemap-stream-parser');

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
    //log('CRAWLDELAY', crawlDelay, ret)
    return ret

}

function matchesOne(str, regexArr) {

    let isMatch = regexArr.some((re) => {
        return !!re.test(str);
    })
    return isMatch
}

const timeouts = {}

class Session {
    constructor(opts) {
        this.lastCurlDate = new Date()
        this.robotsParser = null; //see start()
        this.crawlDelay = opts.crawlDelay || constants.CRAWL_DELAY  //millis
        this.URIcounter = 0;
        this.opts = Object.assign({
            sitemaps: [],
            userAgent: constants.USER_AGENT,
        }, opts);


        //read the css selector
        this.imageSelector = util.deepProp(this.opts.parserClasses, 'recipe.chunks.images.cssSelector')


        this.opts.domain = uritools.getBase(this.opts.domain)

        var _opts = this.opts
        log('construct', _opts)

        this.stats = new Stats(_opts)

        this.storage = new Storage({
            domain: _opts.domain
        })

        this.queue = new CrawlQueue({
            reset: _opts.reset,
            mode: _opts.mode,
            domain: _opts.domain,
            storage: this.storage,
            sessionOpts: _opts,
        })

        if (!_opts.respawned) {
            if (Array.isArray(_opts.initialURIs)) {
                this.queue.pushInitial(_opts.initialURIs)
            }
        }

        ee.on(constants.EV_CRAWL_NEXT, this.crawlNextURI.bind(this));
        ee.on(constants.EV_SHUTDOWN, () => {
            _.each(timeouts, (t, name) => {
                log('CLEAR TIMEOUT', name)
                clearTimeout(t)
            })
        })

    }

    start() {
        log('=>starting')
        var self = this;
        var robotsp = robots(
            this.opts.userAgent,
            this.opts.domain)
        robotsp.then((parser) => {

            if (!this.opts.respawned) {
                if (parser._parser.sitemaps.length) {
                    this.opts.sitemaps = this.opts.sitemaps.concat(parser._parser.sitemaps)
                    let urls = []
                    sitemaps.parseSitemaps(this.opts.sitemaps, function (url) {
                        if (self.filterURI(url)) {
                            urls.push(url)
                        }
                    }, function (err, sitemaps) {
                        if (err) {
                            errlog('SITEMAPS PARSE FAILED')
                            errlog(err)
                        } else {
                            self.queue.pushInitial(urls)
                            log('SITEMAPS PARSED')
                        }
                    });
                }
            }

            //log(parser._parser.options)
            self.robotsParser = parser;
            self.crawlDelay = parser.getCrawlDelay() ? 1000 * parser.getCrawlDelay() : self.crawlDelay
            log('crawl delay is', self.crawlDelay)
            ee.once(constants.EV_STORAGE_CONNECTED, () => {
                const crawledP = self.storage.count({
                    domain: self.opts.domain,
                    state: constants.URI.STATUS_CRAWLED
                })

                crawledP.then((crawledCount) => {
                    return self.storage.count({domain: self.opts.domain}).then((totalCount) => {
                        ee.emit(constants.EV_STATS, {
                            type: 'STORAGE_URI_COUNT',
                            totalCount,
                            crawledCount,
                        })
                        ee.emit(constants.EV_BOOT)
                        log('=>started')
                        self.crawlNextURI(self.getNextURI({initial: true}))
                    })
                }).done();

            })

            self.storage.connect().done();
        })
    }

    stop() {
        //this.storage.disconnect();
        ee.emit(constants.QUEUE_FINISHED, this.uid)

        this.stats.print()

        log('***FINISHED***')

        beep(2)

        //TODO why does it not exit by itself?
        //hanging promises?
        process.exit(0)

    }

    static sleep(seconds = 120) {
        log(`SLEEPING ${seconds} seconds`)
        clearTimeout(timeouts['SLEEP'])
        timeouts['SLEEP'] = setTimeout(() => {
            ee.emit(constants.EV_CRAWL_NEXT)

        }, seconds * 1000)
    }

    static exitWithRestartCode() {
        ee.emit(constants.EV_STORAGE_REQUEST_DISCONNECT);
        process.exit(constants.EXIT_CODE_FOR_RESTART)
    }

    getNextURI(opts = {}) {
        let self = this
        let nextP
        if (opts.initial) {
            log('INITIAL URI ' + self.opts.domain)
            nextP = Q(
                //mimic a queue/curl response to kickstart the root URI
                {
                    uri: self.opts.domain
                })
        } else {
            nextP = this.queue.next();
        }
        return nextP.then(uriModel => {

            if (!uriModel) {
                this.stop()
            }

            let passesFilter = self.filterURI(uriModel.uri)
            if (passesFilter) {
                log('NEXT ==>', uriModel.uri)
                return uriModel
            }
            //excluded, so purge it
            let removeP = self.queue.purge({
                hash: hash(uriModel.uri)
            })
            return removeP.then(() => {
                log('REMOVED EXCLUDED', uriModel.uri)
                let p = Q.defer();
                setTimeout(() => {
                    p.resolve(this.getNextURI())
                }, 0)
                //return this.queue.next();
                return p.promise;
            }).fail((err) => {
                errlog('FAILED TO DELETE', uriModel.uri, err, err.stack)
                process.exit();
            })
        })
    }

    filterURI(uri) {

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
        let isIncluded = includeArr.length === 0 || matchesOne(relURI, includeArr)
        if (!isIncluded) {
            //excludelog('CONF NOT INCLUDED', relURI)
            return null
        }

        let isExcluded = excludeArr.length === 0 ? false : matchesOne(relURI, excludeArr)
        if (isExcluded) {
            return null
        }
        return ret
    }


    pushLinks(links) {
        var records = links.map((l) => {

            if (/\?.+\?/.test(l)) {
                throw new Error('FUCKED ' + l)
            }

            //find opts and attribs in the same model obj
            let ret = {
                __find: {hash: hash(l)},
                dateAdded: util.sqlDateTime(new Date()),
                domain: this.opts.domain,
                uri: l,
                state: constants.URI.STATUS_UNCRAWLED,
            }

            return ret

        })
        //log(records);
        return this.queue.push(records).then(() => {
            log('PUSH DONE')
            return true;
        })
    }

    getCurlP(uriModel) {
        let relURI = '.' + uritools.getRelative(uriModel.uri)
        log(`FETCH URI #${this.URIcounter}`, relURI)
        let mimetypes = constants.TEXT_MIME_TYPES.concat(constants.IMAGE_MIME_TYPES)
        return curl({
            acceptedMimeTypes: mimetypes,
            uri: uriModel.uri
        });
    }

    getLinks(uriModel) {
        let baseURI = uritools.getBase(uriModel.uri)
        let relURI = uritools.getRelative(uriModel.uri)

        //TODO process images
        if (!util.isTextMime(uriModel.mimeType)) {
            return []
        }
        let links = html.getLinks(uriModel.response)
        let filter = this.filterURI.bind(this)
        let normLinks = links.map((l) => {
            return filter(l)
        })
            .filter(l => l !== null)

        normLinks = _.uniq(normLinks);
        return normLinks
    }

    processCurl(result) {
        let self = this;
        log(`FETCH COMPLETED [${result.code}] #` + self.URIcounter,
            uritools.getRelative(result.uri))

        let code = parseInt(result.code, 10)

        //http://www.w3.org/Protocols/rfc2616/rfc2616-sec10.html
        //bad gateway, service unavailable, gateway timeout
        if (code > 500) {
            log('SERVER ERROR, SLEEPING')
            Session.sleep()
            return null
        }

        //if (_.endsWith(result.uri, '/')) {
        //    errlog(result)
        //    throw new Error('INVALID URI')
        //}

        if (result.skip) {
            log('FETCH ERROR', result.reason, result.uri)
        }


        let uriModel = {
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
            uriModel['response'] = result.responseBody
        } else {
            uriModel['binaryResponse'] = result.responseBody
        }
        log('MIME', result.mimeType)

        return uriModel

    }

    getSaveP(uriModel) {
        return this.queue.saveAndRemove(uriModel)
    }

    crawlNextURI(initialUriModel) {
        let self = this
        let nextP = initialUriModel || this.getNextURI();
        nextP.then(uriModel => {
            //log('CRAWL', uriModel.uri)

            let crawlP = this.getCurlP(uriModel).then((result) => {
                self.lastCurlDate = result.dateCompleted || new Date()
                this.URIcounter++;
                let populatedUriModel = this.processCurl(result)
                if (!result) {
                    //fetch error
                    return null
                }
                let links = this.getLinks(populatedUriModel)
                if (links.length) {
                    log(`FOUND ${links.length} LINKS`)
                }
                let saveP = this.getSaveP(populatedUriModel)
                return saveP.then(() => {
                    let pushP = this.pushLinks(links)
                    return pushP.then(() => {

                        if (global.gc && this.URIcounter % 10 === 0) {
                            log('***GC***')
                            global.gc()
                        }

                        if (self.URIcounter > 0 &&
                            self.URIcounter % constants.URL_COUNT_FOR_RESTART === 0) {
                            Session.exitWithRestartCode()
                        }

                        let crawlDelay = computeCrawlDelay(
                            self.lastCurlDate,
                            self.crawlDelay
                        )

                        log(`SCHEDULE NEXT #${this.URIcounter} in ${crawlDelay}ms`)

                        clearTimeout(timeouts['CRAWL'])
                        timeouts['CRAWL'] = setTimeout(() => {
                            ee.emit(constants.EV_CRAWL_NEXT)
                        }, crawlDelay)

                    })

                })
            }).fail((err) => {
                this.lastCurlDate = new Date()
                errlog('CRAWLER FAILED', err, err.stack);
                //errlog('CRAWLER FAILED', err);
                console.log(uriModel.hash);
                console.log(uriModel.uri);
                uriModel.__find = {uri: uriModel.uri};
                this.getSaveP(uriModel).fail(() => {
                    ee.emit(constants.EV_STORAGE_REQUEST_DISCONNECT);
                    ee.emit(constants.EV_SHUTDOWN);
                    process.exit(1)
                }).done()
                Session.sleep(30)
                //errlog(JSON.stringify(err));
            })


        }).fail((err) => {
            errlog(err);
        }).done();


    }


}

module.exports = Session