const Q = require('q')
const LRU = require('lru-cache')
const _ = require('lodash')
const constants = require('./constants')
const LOG_PREFIX = 'QUEUE'
const log = require('./logger').prefix(LOG_PREFIX);
const errlog = require('./logger').error(LOG_PREFIX);

const fakePromise = require('./fakePromise')

class Queue {
    constructor(opts) {

        //https://github.com/isaacs/node-lru-cache
        this.lru = LRU({
            max: constants.LRU_CACHE_SIZE,
            dispose: function (key, n) {
                log('LRU DROP', key)
            }
        });

        this.opts = opts
        this.storage = opts.storage
        log('construct', opts)
    }

    push(o) {
        //TODO first check LRU
        let opts = o;
        if (!_.isArray(opts)) {
            opts = [opts]
        }
        let toPush = [];
        opts.forEach((info)=> {
            let uri = info.uri
            if (!this.lru.get(uri)) {
                toPush.push(info)
            } else {
                //log('LRU CACHED', uri)
            }
        })
        if (toPush.length === 0) {
            return Q(true)
        }
        return this.storage.upsert(toPush, true).then((res)=> {
            //store succeded, so push it to lru
            toPush.forEach((info)=> {
                this.lru.set(info.uri, true)
            })
            return res
        })

    }

    saveAndRemove(o) {
        //this does not remove, but will not return it on next()
        //TODO compute the hash which is the PK
        var opts = _.extend({domain: this.opts.domain}, o)
        opts.state = constants.URI.STATUS_CRAWLED
        return this.storage.upsert(opts)
    }

    next() {
        //TODO return data, not models
        var aggr = {}
        var filter = {domain: this.opts.domain};
        if (this.opts.mode === constants.CRAWL_MODE) {
            aggr = {limit: 1, order: ['dateAdded', 'A']}
            filter.state = constants.URI.STATUS_UNCRAWLED

        }
        return this.storage.findOne(filter, aggr).then((res)=> {
            log('FIND NEXT GOT', res ? res.uri : 'NULL')
            return res
        })
    }

}

module.exports = Queue;
