const prettybytes = require('pretty-bytes')
const moment = require('moment')
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
        this.sessionCrawled = 0;
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

    print() {
        let nowMillis = new Date().getTime()
        let sessionMillis = nowMillis - this.lastRestartDate.getTime()
        let totalMillis = nowMillis - this.startDate.getTime()
        let d = moment.duration(sessionMillis, 'milliseconds')
        let dtotal = moment.duration(totalMillis, 'milliseconds')
        let lruEff = this.lruHits * 100 / ((this.lruHits + this.lruMisses) || 1)
        let lastErr = this.lastCrawlErrors[0] || 'none'

        let tpl =
            `
            Crawl           : sess. ${this.sessionCrawled} / total ${this.crawled}
            Errors          : ${this.crawlErrors}, last: ${lastErr}
            Elapsed time    : sess. ${d.humanize()} / total ${dtotal.humanize()}
            Download size   : ${prettybytes(this.bytes, true)}
            LRU             : eff. ${parseFloat(lruEff).toFixed(2)}%, ${this.lruHits} hit / ${this.lruMisses} miss

            `
        log(tpl)
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
                this.sessionCrawled++;
                this.httpCodes[payload.code] = this.httpCodes[payload.code] || 0
                this.httpCodes[payload.code]++
                this.bytes += payload.SIZE_DOWNLOAD

                if (this.crawled === 0) {
                    this.speed = payload.SPEED_DOWNLOAD
                } else {
                    this.speed = (this.speed + payload.SPEED_DOWNLOAD) / 2
                }

                if (this.sessionCrawled % 10 === 0) {
                    this.print()
                }


                break;
            case 'CURL_ERROR':
                this.crawlErrors++;
                this.lastCrawlErrors.unshift(
                    payload.uri + ' :: ' + payload.error.toString()
                )
                this.lastCrawlErrors = this.lastCrawlErrors.slice(0, 500)

                this.print()

                break;
        }
        //this.print()
        //log('EVENT', payload)
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
            this.sessionCrawled = 0;
            log(`LOADED STATS FROM ${fpath}`)
            this.print()
        }
    }
}

module.exports = Stats
