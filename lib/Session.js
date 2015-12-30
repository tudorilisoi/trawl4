const Storage = require('./Storage');
const Queue = require('./Queue');
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
        log('init')

        let storage = new Storage({
            domain: opts.domain
        })

        this.queue = new Queue({
            domain: opts.domain,
            storage
        })

    }

    getFetchP() {
        let self = this;
        let nextP = this.queue.next();
        let fetchP = nextP.then((info)=> {
            log('FETCH URI', info.uri)
            return curl({
                uri: info.uri
            });
        })

        fetchP.then((result)=> {
            self.URIcounter++;
            //tell queue to make it crawled
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


        }).done();

    }

    start() {
        log('start')
        this.getFetchP()
    }
}

module.exports = Session