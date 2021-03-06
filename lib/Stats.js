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
        this.sessionPushed = 0;
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
        this.lastStopDate = null;
        this.completedDate = null;

        ee.on(constants.EV_BOOT, this.load.bind(this))
        ee.on(constants.EV_SHUTDOWN, this.save.bind(this))
        ee.on(constants.EV_STATS, this.handleEvent.bind(this))
        ee.on(constants.QUEUE_FINISHED, function () {
            this.completedDate = new Date();
        }.bind(this))
    }

    print() {
        let idleMillis = 0
        if (this.lastStopDate && this.lastRestartDate) {
            idleMillis = this.lastRestartDate.getTime() - this.lastStopDate.getTime()
        }
        let nowMillis = new Date().getTime()
        let sessionMillis = nowMillis - this.lastRestartDate.getTime()
        let totalMillis = nowMillis - this.startDate.getTime() - idleMillis
        let d = moment.duration(sessionMillis, 'milliseconds')
        let dtotal = moment.duration(totalMillis, 'milliseconds')
        let avgSpeed = this.bytes / ((dtotal + 1) / 1000 / 60)
        let lruEff = this.lruHits * 100 / ((this.lruHits + this.lruMisses) || 1)
        let lastErr = this.lastCrawlErrors[0] || 'none'

        let crawlRate = !this.crawled || !totalMillis ? 0 : this.crawled / (totalMillis / 1000 / 60)
        let pushRate = !this.pushed || !totalMillis ? 0 : this.pushed / (totalMillis / 1000 / 60)

        let scrawlRate = !this.sessionCrawled || !sessionMillis ? 0 : this.sessionCrawled / (sessionMillis / 1000 / 60) || 0
        let spushRate = !this.sessionPushed || !sessionMillis ? 0 : this.sessionPushed / (sessionMillis / 1000 / 60) || 0

        let remaining = this.pushed - this.crawled
        let eta = 'N/A'
        let queueAdvanceRate = scrawlRate - spushRate
        if (remaining && queueAdvanceRate > 0) {
            eta = remaining / queueAdvanceRate
            eta = moment.duration(eta, 'minutes').humanize()
        }

        let tpl =
            `
            Elapsed time/ETA : ETA: ${eta}, sess. ${d.humanize()}/total ${dtotal.humanize()}
            Speed            : crawl rate: ${scrawlRate.toFixed(2)}/min, push rate ${spushRate.toFixed(2)}/min

            AVG Speed        : crawl rate: ${crawlRate.toFixed(2)}/min, push rate ${pushRate.toFixed(2)}/min
            Crawl counters   : discovered: ${this.pushed}, crawled: sess. ${this.sessionCrawled}/total ${this.crawled}

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
            case 'STORAGE_URI_COUNT':
                this.pushed = payload.totalCount;
                this.crawled = payload.crawledCount;
                this.print()
                break;
            case 'LRU_HIT':
                this.lruHits++;
                break;
            case 'LRU_MISS':
                this.lruMisses++;
                break;
            case 'STORAGE_PUSH':
                this.pushed++;
                this.sessionPushed++;
                break;
            case 'STORAGE_DELETE':
                this.pushed--;
                if (payload.model.state === constants.URI.STATUS_CRAWLED) {
                    this.crawled--;
                }
                break;
            case 'CURL_COMPLETED':
                const so = this.opts
                if (so.respawned) {

                    //exclude seed and initial domain since these are re-crawled
                    if (payload.uri === so.domain) {
                        break;
                    }

                    if (so.initialURIs && so.initialURIs.includes(payload.uri)) {
                        break;
                    }

                }
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
        this.lastStopDate = new Date()
        let fpath = util.getRuntimePath(this.opts.domain, '--STATS.json')
        let dump = JSON.stringify(this, 2, 2)
        fs.writeFileSync(fpath, dump, 'utf-8')
        log('SAVED STATS AS ' + fpath)
    }

    load() {
        let fpath = util.getRuntimePath(this.opts.domain, '--STATS.json')

        let count = this.pushed || 0;
        let crawled = this.crawled || 0;

        if (fs.existsSync(fpath)) {
            let contents = fs.readFileSync(fpath).toString()
            let dump = JSON.parse(contents)
            _.extend(this, dump)

            this.pushed = count; //this is set by storage with an event
            this.crawled = crawled; //this is set by storage with an event

            //convert from JSON
            this.startDate = new Date(this.startDate)
            this.lastStopDate && (this.lastStopDate = new Date(this.lastStopDate))
            this.lastRestartDate = new Date();
            this.sessionCrawled = 0;


            log(`LOADED STATS FROM ${fpath}`)
            this.print()
        }
    }
}

module.exports = Stats
