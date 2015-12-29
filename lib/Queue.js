const LOG_PREFIX = 'QUEUE'
const log = require('./logger').prefix(LOG_PREFIX);
const errlog = require('./logger').error(LOG_PREFIX);

const fakePromise = require('./fakePromise')

class Queue {
    constructor(opts) {
        this.opts = opts
        log(`domain is ${opts.domain}`)
    }

    push(o) {

    }

    next(o) {
        return fakePromise.resolve({
            uri: '/index',
            status: 'UNCRAWLED'
        });
    }

}

module.exports = Queue;
