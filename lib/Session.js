const ee = require('./eventBus');
const constants = require('./constants')

const Storage = require('./Storage');
const CrawlQueue = require('./CrawlQueue');
const curl = require('./curl');

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
        this.URIcounter = 0;
        this.opts = opts;
        this.lastReqTime = null;
        log('init', this.opts)

        this.storage = new Storage({
            domain: opts.domain
        })

        this.queue = new CrawlQueue({
            mode:opts.mode,
            domain: opts.domain,
            storage:this.storage
        })

    }

    stop() {
        this.storage.disconnect();
        log('***FINISHED***')

        //TODO why does it not exit by itself?
        //hanging promises?
        process.exit(0)

    }

    getFetchP() {
        let stop = false;
        let self = this;
        let nextP = this.queue.next();
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
            log('FETCH DONE', self.URIcounter, result)

            self.queue.saveAndRemove({
                uri: result.uri,
                response: result.response
            }).then(
                ()=> {
                    log('SAVE DONE')
                    setTimeout(self.getFetchP.bind(self), computeCrawlDelay())
                }
            ).done();


        }).done(()=>{
            //log('FETCH DONE')
        });

    }

    start() {
        ee.once(constants.EV_STORAGE_CONNECTED, ()=> {
            log('start')
            this.getFetchP()
        })
    }
}

module.exports = Session