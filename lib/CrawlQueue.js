const fs = require('fs')
const hash = require('./hash')
const ee = require('./eventBus')
const util = require('./util')
const uritools = require('./uritools')
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

        this.opts = opts
        this.storage = opts.storage

        if (opts.reset) {
            this.resetLRU()
        } else {
            this.initLRU()
        }
            this.initLRU()

        ee.on(constants.EV_SHUTDOWN, this.saveLRU.bind(this))
        ee.on(constants.EV_BOOT, this.loadLRU.bind(this))
        ee.on(constants.QUEUE_FINISHED, this.resetLRU.bind(this))

        log('construct', opts)
    }

    initLRU() {
        //https://github.com/isaacs/node-lru-cache
        this.lru = LRU({
            max: constants.LRU_CACHE_SIZE,
            dispose: function (key, n) {
                if (key) {
                    log('LRU DROP', key)
                    ee.emit(constants.EV_STATS, {
                        type: 'LRU_DROP'
                    })
                }
            }
        });
    }

    resetLRU() {
        log('CLEAR LRU')
        this.initLRU()
        this.saveLRU()
    }

    saveLRU() {
        let fpath = util.getRuntimePath(this.opts.domain, '--LRU.json')
        let lruDump = JSON.stringify(this.lru.dump(), 2, 2)
        fs.writeFileSync(fpath, lruDump, 'utf-8')
        log('SAVED LRU AS ' + fpath)
    }

    loadLRU() {
        let fpath = util.getRuntimePath(this.opts.domain, '--LRU.json')
        if (fs.existsSync(fpath)) {
            let contents = fs.readFileSync(fpath).toString()
            let lruDump = JSON.parse(contents)
            this.lru.load(lruDump)
            log(`LOADED ${this.lru.itemCount} LRU ITEMS FROM ${fpath}`)
        }
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
            let hit = false;
            if (!this.lru.get(uri)) {
                toPush.push(info)
            } else {
                hit = true
                //log('LRU CACHED', uri)
            }

            ee.emit(constants.EV_STATS, {
                type: hit ? 'LRU_HIT' : 'LRU_MISS'
            })

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

    purge(o) {
        var opts = _.extend({domain: this.opts.domain}, o)
        return this.storage.delete(opts)
    }

    saveAndRemove(o) {
        //this updates and will not return it on next()
        let opts = Object.assign({
            domain: this.opts.domain,
        }, o)
        opts.state = constants.URI.STATUS_CRAWLED
        return this.storage.upsert(opts)
    }

    next() {
        //TODO return data, not models
        var aggr = {}
        var filter = {domain: this.opts.domain};
        if (this.opts.mode === constants.CRAWL_MODE) {

            //order by date added desc feels like browsing naturally
            //and optimizes the LRU
            aggr = {limit: 1, order: ['dateAdded', 'A']}
            filter.state = constants.URI.STATUS_UNCRAWLED

        }
        return this.storage.findOne(filter, aggr).then((res)=> {
            log('FIND NEXT RETURNED', res ? uritools.getRelative(res.uri) : 'NULL')
            return res
        })
    }

}

module.exports = Queue;
