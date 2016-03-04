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

function matchesOne(str, regexArr) {

    let isMatch = regexArr.some((re)=> {
        return !!re.test(str);
    })
    return isMatch
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
                this.crawlNextURI(self.getNextURI({initial: true}))
            })
            self.storage.connect();
        }).done();
    }

    stop() {
        //this.storage.disconnect();
        ee.emit(constants.QUEUE_FINISHED, this.uid)

        log('***FINISHED***')

        //TODO why does it not exit by itself?
        //hanging promises?
        process.exit(0)

    }

    getNextURI(opts = {}) {
        let self = this
        let nextP
        if (opts.initial) {
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
        return nextP.then(uriModel=> {
            let passesFilter = self.filterURI(uriModel.uri)
            if (passesFilter) {
                log('NEXT ==>', uriModel.uri)
                return uriModel
            }
            //excluded, so purge it
            let removeP = self.queue.purge({
                hash: hash(uriModel.uri)
            })
            return removeP.then(()=> {
                log('REMOVED EXCLUDED', uriModel.uri)
                return this.queue.next();
            }).fail((err)=> {
                errlog('FAILED TO DELETE', relURI, err, err.stack)
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
        let isIncluded = matchesOne(relURI, includeArr)
        if (!isIncluded) {
            //excludelog('CONF NOT INCLUDED', relURI)
            return null
        }

        let isExcluded = matchesOne(relURI, excludeArr)
        if (isExcluded) {
            return null
        }
        return ret
    }


    pushLinks(links) {
        var records = links.map((l)=> {

            if (/\?.+\?/.test(l)) {
                throw new Error('FUCKED ' + l)
            }

            //find opts and attribs in the same obj
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
        return this.queue.push(records).then(()=> {
            log('PUSH DONE')
            return true;
        })
    }

    getCurlP(uriModel) {
        let relURI = '.' + uritools.getRelative(uriModel.uri)
        log('FETCH URI', relURI)
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
        let normLinks = links.map((l)=> {
                return filter(l)
            })
            .filter(l=>l !== null)

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
            log('SERVER ERROR')
            Session.sleep()
            return
        }

        //if (_.endsWith(result.uri, '/')) {
        //    errlog(result)
        //    throw new Error('INVALID URI')
        //}

        if (result.skip) {
            log('PARSER EXCLUDE/FETCH ERROR', result.reason, result.uri)
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

    crawlNextURI() {
        this.getNextURI().then(uriModel=> {

            if(!uriModel){
                this.stop()
            }

            log('CRAWL', uriModel.uri)

            let crawlP = this.getCurlP(uriModel).then((result)=> {
                this.URIcounter++;
                let populatedUriModel = this.processCurl(result)
                let links = this.getLinks(populatedUriModel)
                if(links.length){
                    log(`FOUND ${links.length} LINKS`)
                }
                let saveP = this.getSaveP(populatedUriModel)
                saveP.then(()=> {
                    let pushP = this.pushLinks(links)
                    return pushP.then(()=> {
                        let crawlDelay = computeCrawlDelay(
                            result.dateCompleted || new Date(),
                            this.crawlDelay
                        )

                        setTimeout(()=> {
                            ee.emit(constants.EV_CRAWL_NEXT)
                        }, crawlDelay)

                    })

                })
            }).fail((err)=> {
                errlog(err);
            })


        })


    }


}

module.exports = Session