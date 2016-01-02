const sleep = require('sleep')
const _ = require('lodash')
const Q = require('q');
const ee = require('./eventBus');
const constants = require('./constants')
const util = require('./util')

const Storage = require('./Storage');
const CrawlQueue = require('./CrawlQueue');
const Stats = require('./Stats');
const curl = require('./curl');
const html = require('./html');
const uritools = require('./uritools');

const robots = require('./robotstxt.js')

const LOG_PREFIX = 'SESSION'
const log = require('./logger').prefix(LOG_PREFIX);
const errlog = require('./logger').error(LOG_PREFIX);

function computeCrawlDelay(lastReqDate, crawlDelay) {
    let now = new Date().getTime()
    let last = lastReqDate.getTime();
    let elapsed = now - last;
    var ret = Math.max(crawlDelay - elapsed, 0)
    log('CRAWLDELAY', crawlDelay, ret)
    return ret

}

class Session {
    constructor(opts) {
        this.robotsParser = null; //see start()
        this.crawlDelay = opts.crawlDelay || constants.CRAWL_DELAY  //millis
        this.URIcounter = 0;
        this.opts = opts;
        this.lastReqTime = null;
        log('construct', this.opts)

        this.stats = new Stats(opts)

        this.storage = new Storage({
            domain: opts.domain
        })

        this.queue = new CrawlQueue({
            mode: opts.mode,
            domain: opts.domain,
            storage: this.storage
        })

        ee.on(constants.EV_CRAWL_NEXT, this.crawlNextURI.bind(this));

    }

    sleep(seconds = 120) {
        log(`SLEEPING ${seconds} seconds`)
        sleep.sleep(seconds)
        ee.emit(constants.EV_CRAWL_NEXT)
    }

    exitWithRestartCode() {
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

    requestP(o) {
        var opts = o;
        curl({
            uri: opts.uri
        }).then(
            (result)=> {
                //TODO NOTE uri may change on curl redirect
                log(result)
                //parse links
            }
        )
    }

    processCurlP(info) {

        //excluded
        if (info.skip) {
            return Q(true)
        }
        //log(info)
        let baseURI = info.baseURI
        let links = html.getLinks(info.responseBody)
        let normLinks = links.map((l)=> {
                let ret = uritools.normalize(l, baseURI)
                if (!this.robotsParser.isAllowed(ret)) {
                    log('ROBOTS EXCLUDED', ret)
                    ret = null
                }
                return ret
            })
            .filter(l=>l !== null)
        normLinks = _.uniq(normLinks);
        //log(links, normLinks)
        log(`FOUND ${normLinks.length}/${links.length} LINKS`)

        var records = normLinks.map((l)=> {
            return {
                dateAdded: util.sqlDateTime(new Date()),
                domain: this.opts.domain,
                uri: l,
                state: constants.URI.STATUS_UNCRAWLED
            }
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
                    || uritools.normalize(self.opts.domain, self.opts.domain)
                })
        } else {
            nextP = this.queue.next();
        }


        let crawlP = nextP.then((info)=> {
            if (!info) {
                stop = true;
                return;
            }
            log('====> NEXT:', info ? info.uri : 'NULL')
            log('FETCH URI', info.uri)
            return curl({
                uri: info.uri
            });
        })

        crawlP.then((result)=> {
            self.URIcounter++;

            if (stop) {
                return self.stop(self);
            }


            //tell CrawlQueue to make it crawled
            //parse it
            //log('FETCH DONE', self.URIcounter, result)
            log(`FETCH COMPLETED [${result.code}] #` + self.URIcounter, result.uri)

            if (_.endsWith(result.uri, '/')) {
                errlog(result)
                throw new Error('INVALID URI')
            }

            if (result.skip) {
                log('PARSER EXCLUDE/FETCH ERROR', result.reason, result.uri)
            }

            return self.queue.saveAndRemove({
                //TODO filter by regex
                dateLastCrawled: util.sqlDateTime(new Date()),
                excluded: result.skip ? 1 : 0,
                //the final uri may be different because of redirects
                uri: result.initialURI,
                response: result.responseBody
            }).then(
                ()=> {
                    log('SAVE DONE', result.initialURI)

                    return self.processCurlP(result).then(()=> {

                        if (self.URIcounter > 0 &&
                            self.URIcounter % constants.URL_COUNT_FOR_RESTART === 0) {
                            self.exitWithRestartCode()
                        }

                        if (global.gc && this.URIcounter % 10 === 0) {
                            log('***GC***')
                            global.gc()
                        }

                        log('SCHEDULE NEXT #' + (this.URIcounter + 1))

                        //this can cause infinite closures
                        //http://stackoverflow.com/questions/16072699/nodejs-settimeout-memory-leak

                        var timeout = null;
                        timeout = setTimeout(function () {
                            clearTimeout(timeout)
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
                errlog('CRAWLER FAILED', err);
                self.sleep(120)
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