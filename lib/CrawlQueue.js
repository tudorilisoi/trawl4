const constants = require('./constants')
const LOG_PREFIX = 'QUEUE'
const log = require('./logger').prefix(LOG_PREFIX);
const errlog = require('./logger').error(LOG_PREFIX);

const fakePromise = require('./fakePromise')

class Queue {
    constructor(opts) {
        this.opts = opts
        this.storage = opts.storage
        log('construct', opts)
    }

    push(o) {
        //TODO first check LRU
        return this.storage.upsert(o)
    }

    saveAndRemove(o) {
        //this does not remove, but will not return it on next()
        return this.storage.upsert(o)
    }

    next() {
        //TODO return data, not models
        var aggr = {}
        var filter = {domain: this.opts.domain};
        if (this.opts.mode === constants.CRAWL_MODE) {
            aggr = {limit: 1, order: ['dateAdded', 'A']}
            filter.state = constants.URI.STATUS_UNCRAWELD

        }
        return this.storage.findOne(filter, aggr)
    }

}

module.exports = Queue;
