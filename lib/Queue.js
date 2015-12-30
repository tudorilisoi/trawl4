const LOG_PREFIX = 'QUEUE'
const log = require('./logger').prefix(LOG_PREFIX);
const errlog = require('./logger').error(LOG_PREFIX);

const fakePromise = require('./fakePromise')

class Queue {
    constructor(opts) {
        this.opts = opts
        this.storage = opts.storage
        log(`domain is ${opts.domain}`)
    }

    push(o) {
        return this.storage.upsert(o)
    }

    saveAndRemove(o){
        return this.storage.upsert(o)
    }

    next(o) {
        //TODO return data, not models
        return this.storage.find()
    }

}

module.exports = Queue;
