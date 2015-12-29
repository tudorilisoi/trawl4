const LOG_PREFIX = 'QUEUE'
const log = require('./logger').prefix(LOG_PREFIX);
const errlog = require('./logger').error(LOG_PREFIX);

class Queue {
    constructor(opts) {
        log(`domain is ${opts.domain}`)
    }

}

module.exports = Queue;
