const constants = require('./constants')
const ee = require('./eventBus');

const LOG_PREFIX = 'STORAGE'
const log = require('./logger').prefix(LOG_PREFIX);
const errlog = require('./logger').error(LOG_PREFIX);

const fakePromise = require('./fakePromise')

const connect = require('./db/connect')

class Storage {
    constructor(opts) {

        this.connected = false;
        this.opts = opts
        log(`domain is ${opts.domain}`)
        log(`connect`)
        //connect
        this._connect();

    }

    _emitConnected(){
        ee.emit(constants.EV_STORAGE_CONNECTED)
    }

    _connect(){
        var self = this;
        connect.connect().then((db)=> {
            //setup
            require('./db/models/QueueModel');
            log('DB connected')
            connect.sync(()=> {
                log('DB synced')
                self.connected = true;
                self._emitConnected()
            })

        }).fail((err)=> {
            self.connected = false;
            errlog(err);
            throw new Error('DB_CONNECT_FAILED')
        }).done();
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