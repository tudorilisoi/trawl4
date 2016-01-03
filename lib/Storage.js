const constants = require('./constants')
const hash = require('./hash')
const ee = require('./eventBus');
const Q = require('q');
const _ = require('lodash')

const LOG_PREFIX = 'STORAGE'
const log = require('./logger').prefix(LOG_PREFIX);
const errlog = require('./logger').error(LOG_PREFIX);

const fakePromise = require('./fakePromise')

const connect = require('./db/connect')

class Storage {
    constructor(opts) {

        this.connected = false;
        this.opts = opts
        log('construct', opts)
        //connect
        //this._connect();
        ee.on(constants.EV_STORAGE_REQUEST_DISCONNECT, this.disconnect)

    }

    _emitConnected() {
        ee.emit(constants.EV_STORAGE_CONNECTED)
    }

    disconnect() {
        connect.disconnect()
        log('disconnected')
    }

    connect() {
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

    findOne(filter = {}, aggr = {}) {

        let _filter = _.extend({}, filter);
        let _aggr = _.extend({limit: 1}, aggr);

        var qm = require('./db/models/QueueModel');
        var p = Q.nfcall(qm.find, _filter, _aggr)

        return p.then((res)=> {
            log('find one', _filter, _aggr, res ? 'OK' : 'NOT IN DB')
            return res[0] ? res[0] : null
        })
    }

    find(opts) {

        var qm = require('./db/models/QueueModel');
        var p = Q.nfcall(qm.find, opts)

        return p.then((res)=> {
            log('find', opts, res)
            return res
        })
    }

    delete(o) {
        //let d = Q.defer();
        let p = this.findOne(o)

        return p.then((res)=> {
            if (res) {
                return Q.nfcall(res.remove)
            } else {
                throw new Error('RECORD_NOT_FOUND')
            }
        })
    }

    upsert(o, skipUpdates = false) {
        if (!_.isArray(o)) {
            return this._upsert(o, skipUpdates)
        }

        if (o.length == 0) {
            return Q(true)
        }

        let self = this;
        let ps = o.map((item)=> {
            return self._upsert(item, skipUpdates)
        })
        return Q.all(ps);

    }

    _upsert(o, skipUpdates) {
        //log(o)
        var qm = require('./db/models/QueueModel');
        var opts = _.extend({}, o)
        var findP = this.findOne(opts.__find)
        return findP.then((res)=> {
            if (res) {
                if (skipUpdates) {
                    //log('SKIP UPSERT', opts)
                    return Q(true)
                }
                _.assign(res, opts)
                return Q.nfcall(res.save)
            } else {
                let props = {};
                _.each(qm._definition, (val, key)=> {
                    props[key] = opts[key]
                })
                return Q.nfcall(qm.create, props).then((res)=> {
                    ee.emit(constants.EV_STATS, {
                        type: 'STORAGE_PUSH',
                        props
                    })
                    return res;
                })
            }
        }).fail(err=> {
            errlog(err)
            process.exit();
        }).then((res)=> {
            log('UPSERT', opts.uri, opts.state || 0)
            return res;
        })


        //return fakePromise.resolve(opts)
    }


}

module.exports = Storage;