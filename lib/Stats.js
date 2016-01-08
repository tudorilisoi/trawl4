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
        this.lruDrops = 0;
        this.startDate = new Date();
        this.lastRestartDate = new Date();
        this.completedDate = null;

        ee.on(constants.EV_BOOT, this.load.bind(this))
        ee.on(constants.EV_SHUTDOWN, this.save.bind(this))
        ee.on(constants.EV_STATS, this.handleEvent.bind(this))
        ee.on(constants.QUEUE_FINISHED, function () {
            this.completedDate = new Date();
        }.bind(this))
    }

    print() {
        let nowMillis = new Date().getTime()
        let sessionMillis = nowMillis - this.lastRestartDate.getTime()
        let totalMillis = nowMillis - this.startDate.getTime()
        let d = moment.duration(sessionMillis, 'milliseconds')
        let dtotal = moment.duration(totalMillis, 'milliseconds')
        let avgSpeed = this.bytes / ((dtotal + 1) / 1000 / 60)
        let lruEff = this.lruHits * 100 / ((this.lruHits + this.lruMisses) || 1)
        let lastErr = this.lastCrawlErrors[0] || 'none'

        let crawlRate = this.crawled / (totalMillis / 1000 / 60)
        let pushRate = this.pushed / (totalMillis / 1000 / 60)
        let remaining = this.pushed - this.crawled
        let eta = 'N/A'
        let queueAdvanceRate = crawlRate - pushRate
        if (remaining && queueAdvanceRate > 0) {
            eta = remaining / queueAdvanceRate
            eta = moment.duration(eta, 'minutes').humanize()
        }

        let tpl =
            `
            Elapsed time/ETA : ETA: ${eta}, sess. ${d.humanize()}/total ${dtotal.humanize()}
            Speed            : crawl rate: ${crawlRate.toFixed(2)}/min, push rate ${pushRate.toFixed(2)}/min
            Crawl counters   : pushed: ${this.pushed}, crawled: sess. ${this.sessionCrawled}/total ${this.crawled}
            Download size    : ${prettybytes(this.bytes, true)}, avg. dload speed ${prettybytes(avgSpeed, true)}/min
            LRU              : eff. ${parseFloat(lruEff).toFixed(2)}%, ${this.lruHits} hit/${this.lruMisses} miss, drops: ${this.lruDrops}
            Errors           : ${this.crawlErrors}, last: ${lastErr}

            `
        log(tpl)
    }

    handleEvent(payload) {
        this.ellapsedMillis = new Date().getTime() - this.startDate.getTime();
        switch (payload.type) {

            case 'LRU_DROP':
                this.lruDrops++;
                break;
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
                this.lastCrawlErrors = this.lastCrawlErrors.slice(0, 499)

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
