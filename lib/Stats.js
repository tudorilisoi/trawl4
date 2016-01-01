const fs = require('fs')
const _ = require('lodash')
const ee = require('./eventBus');
const constants = require('./constants')
const util = require('./util')

const LOG_PREFIX = 'STATS'
const log = require('./logger').prefix(LOG_PREFIX);
const errlog = require('./logger').error(LOG_PREFIX);

class Stats {
    constructor(o) {
        this.opts = _.extend({}, o);
        this.crawled = 0;
        this.speed = 0;
        this.bytes = 0;
        this.httpCodes = {};
        this.crawlErrors = 0;
        this.lastCrawlErrors = [];
        this.pushed = 0;
        this.ellapsedMillis = 0;
        this.lruHits = 0;
        this.lruMisses = 0;
        this.startDate = new Date();
        this.lastRestartDate = new Date();

        ee.on(constants.EV_BOOT, this.load.bind(this))
        ee.on(constants.EV_SHUTDOWN, this.save.bind(this))
        ee.on(constants.EV_STATS, this.handleEvent.bind(this))
    }

    handleEvent(payload) {
        this.ellapsedMillis = new Date().getTime() - this.startDate.getTime();
        switch (payload.type) {

            case 'LRU_HIT':
                this.lruHits++;
                break;
            case 'LRU_MISS':
                this.lruMisses++;
                break;
            case 'STORAGE_PUSH':
                this.pushed++;
                break;
            case 'CURL_COMPLETED':
                this.crawled++;
                this.httpCodes[payload.code] = this.httpCodes[payload.code] || 0
                this.httpCodes[payload.code]++
                this.bytes += payload.SIZE_DOWNLOAD

                if (this.crawled === 0) {
                    this.speed = payload.SPEED_DOWNLOAD
                } else {
                    this.speed = (this.speed + payload.SPEED_DOWNLOAD) / 2
                }
                break;
            case 'CURL_ERROR':
                this.crawlErrors++;
                this.lastCrawlErrors.unshift(
                    payload.uri + ' :: ' + payload.error.toString()
                )
                this.lastCrawlErrors = this.lastCrawlErrors.slice(0, 500)
                log(this.lastCrawlErrors)
                break;
        }
        log('EVENT', payload)
        //log('STATS', this)
    }

    save() {
        let fpath = util.getRuntimePath(this.opts.domain, '--STATS.json')
        let dump = JSON.stringify(this, 2, 2)
        fs.writeFileSync(fpath, dump, 'utf-8')
        log('SAVED STATS AS ' + fpath)
    }

    load() {
        let fpath = util.getRuntimePath(this.opts.domain, '--STATS.json')
        if (fs.existsSync(fpath)) {
            let contents = fs.readFileSync(fpath).toString()
            let dump = JSON.parse(contents)
            _.extend(this, dump)
            //convert from JSON
            this.startDate = new Date(this.startDate)
            this.lastRestartDate = new Date();
            log(`LOADED STATS FROM ${fpath}`)
        }
    }
}

module.exports = Stats
