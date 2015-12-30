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

function computeCrawlDelay() {
    //return 10;
    return 1500;
}

function fetchRobots() {
}

class Session {
    constructor(opts) {
        this.robotsParser = null; //see start()
        this.crawlDelay = 6000 //millis
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
        let baseURI = info.uri
        let links = html.getLinks(info.responseBody)
        let normLinks = links.map((l)=> {
                return uritools.normalize(l, baseURI)
            })
            .filter(l=>l !== null)
        log(links, normLinks)
    }

    getFetchP(initial = false) {
        let stop = false;
        let self = this;

        let nextP;

        if (initial) {
            nextP = Q({
                uri: self.opts.domain
            })
        } else {
            nextP = this.queue.next();
        }


        let fetchP = nextP.then((info)=> {
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
            log('FETCH DONE', self.URIcounter)

            self.processCurlP(result)

            self.queue.saveAndRemove({
                uri: result.uri,
                response: result.responseBody
            }).then(
                ()=> {
                    log('SAVE DONE')
                    setTimeout(self.getFetchP.bind(self), computeCrawlDelay())
                }
            ).done();


        }).done(()=> {
            //log('FETCH DONE')
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
            self.parser = parser;
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