const LOG_PREFIX = 'STORAGE'
const log = require('./logger').prefix(LOG_PREFIX);
const errlog = require('./logger').error(LOG_PREFIX);

const fakePromise = require('./fakePromise')

class Storage {
    constructor(opts) {
        this.opts = opts
        log(`domain is ${opts.domain}`)
        log(`connect`)
        //connect
    }


    find(opts) {
        return fakePromise.resolve({
            uri: '/index',
            status: 'UNCRAWLED'
        })
    }

    upsert(opts) {
        return fakePromise.resolve(opts)
    }


}

module.exports = Storage;