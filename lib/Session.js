var Storage = require('./Storage');
var Queue = require('./Queue');

const LOG_PREFIX='SESSION'
const log = require('./logger').prefix(LOG_PREFIX);
const errlog = require('./logger').error(LOG_PREFIX);


class Session {
    constructor(opts) {
        this.opts = opts;
        log('init')
        this.queue = new Queue({
            domain: opts.domain
        })

    }

    start() {
        log('start')
    }
}

module.exports = Session