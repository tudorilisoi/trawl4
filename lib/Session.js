const _ = require('lodash')
const Q = require('q');
const ee = require('./eventBus');
const constants = require('./constants')

const Storage = require('./Storage');
const CrawlQueue = require('./CrawlQueue');
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

function fetchRobots() {
}

class Session {
    constructor(opts) {
        this.robotsParser = null; //see start()
        this.crawlDelay = opts.crawlDelay || constants.CRAWL_DELAY  //millis
        this.URIcounter = 0;
        this.opts = opts;
        this.lastReqTime = null;
        log('construct', this.opts)

        this.storage = new Storage({
            domain: opts.domain
        })

        this.queue = new CrawlQueue({
            mode: opts.mode,
            domain: opts.domain,
            storage: this.storage
        })

    }

    stop() {
        this.storage.disconnect();
        ee.emit(constants.QUEUE_FINISHED, this.uid)
        log('***FINISHED***')

        //TODO why does it not exit by itself?
        //hanging promises?
        //process.exit(0)

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
        //log(info)
        let baseURI = info.baseURI
        let links = html.getLinks(info.responseBody)
        let normLinks = links.map((l)=> {
                return uritools.normalize(l, baseURI)
            })
            .filter(l=>l !== null)
        normLinks = _.uniq(normLinks);
        log(links, normLinks)

        var records = normLinks.map((l)=> {
            return {
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

    getFetchP(initial = false) {
        let stop = false;
        let self = this;

        let nextP;

        if (initial) {
            log('INITIAL URI')
            nextP = Q(
                //mimic a queue/curl response to kickstart the root URI
                {
                    uri: self.opts.domain
                })
        } else {
            nextP = this.queue.next();
        }


        let fetchP = nextP.then((info)=> {
            log('NEXT:', info ? info.uri : 'NULL')
            if (!info) {
                stop = true;
                return;
            }
            log('FETCH URI', info.uri)
            return curl({
                uri: info.uri
            });
        })

        fetchP.then((result)=> {

            if (stop) {
                return self.stop(self);
            }

            self.URIcounter++;
            //tell CrawlQueue to make it crawled
            //parse it
            //log('FETCH DONE', self.URIcounter, result)
            log('FETCH DONE #' + self.URIcounter, result.uri)

            if (_.endsWith(result.uri, '/')) {
                errlog(result)
                throw new Error('INVALID URI')
            }

            return self.queue.saveAndRemove({

                //the final uri may be different because of redirects
                uri: result.initialURI,
                response: result.responseBody
            }).then(
                ()=> {
                    log('SAVE DONE', result.initialURI)

                    return self.processCurlP(result).then(()=> {

                        if (global.gc && this.URIcounter % 100 === 0) {
                            log('***GC***')
                            global.gc()
                        }

                        log('SCHEDULE NEXT #' + (this.URIcounter + 1))
                        setTimeout(self.getFetchP.bind(self), computeCrawlDelay(
                            result.dateCompleted, self.crawlDelay
                        ))
                        return true

                    })

                }
            ).fail((err)=> {
                errlog(err);
            })
            //.done();


        }).done(()=> {
            //log('FETCH DONE', result.uri)
        });

    }

    start() {
        log('=>starting')
        var self = this;
        var robotsp = robots(
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Ubuntu Chromium/47.0.2526.73 Chrome/47.0.2526.73 Safari/537.36',
            this.opts.domain)
        robotsp.then((parser)=> {
            //log(parser._parser.options)
            self.robotsParser = parser;
            self.crawlDelay = parser.getCrawlDelay() || self.crawlDelay
            log('crawl delay is', self.crawlDelay)
            ee.once(constants.EV_STORAGE_CONNECTED, ()=> {
                log('=>started')
                this.getFetchP(true)
            })
            self.storage.connect();
        }).done();
    }
}

module.exports = Session