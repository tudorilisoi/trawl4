//to build libcurl from the latest source
//http://askubuntu.com/questions/173085/how-do-i-build-libcurl-from-source

const moment = require('moment')
const _ = require('lodash')
const path = require('path')
const fs = require('fs')
const util = require('util')
const Q = require('q')
var zlib = require('zlib');


const constants = require('./constants')
var Curl = require('node-libcurl').Curl

const LOG_PREFIX = 'CURL'
const log = require('./logger').prefix(LOG_PREFIX);
const errlog = require('./logger').error(LOG_PREFIX);
const fakePromise = require('./fakePromise')
const url = require('url')
const uritools = require('./uritools')
const ee = require('./eventBus');

const CURL_TIMEOUT_CODE = 28

function fetch(opts) {

    //TODO: emit stat  events with codes, fetch time, bytes

    let parsed = url.parse(opts.uri);
    let jarFile = parsed.host.replace(/\W+/g, '-') + '.txt';

    var d = Q.defer();
    var curl = new Curl();

    var cookieJarFile = path.join(__dirname, '/../runtime/' + jarFile);
    if (!fs.existsSync(cookieJarFile)) {
        fs.writeFileSync(cookieJarFile);
    }

    curl.setOpt(Curl.option.USERAGENT, opts.userAgent || constants.USER_AGENT);
    curl.setOpt(Curl.option.COOKIEFILE, cookieJarFile);
    curl.setOpt(Curl.option.COOKIEJAR, cookieJarFile);
    curl.setOpt(Curl.option.ACCEPT_ENCODING, 'gzip,deflate');

    // console.log(Curl.option);


    var infoTypes = Curl.info.debug,
        EOL = ( process.platform === 'win32' ? '\r\n' : '\n' );

    //log(infoTypes)

    var debugCallback = function (infoType, content) {

        var text = '';

        switch (infoType) {

            case infoTypes.HEADER_IN:
                text = '-- RECEIVING HEADER: ' + EOL + content;
                break;
            case infoTypes.HEADER_OUT:
                text = '-- SENDING HEADER: ' + EOL + content;
                break;
            //case infoTypes.TEXT:
            //    text = content;
            //    break;
            //case infoTypes.DATA_IN:
            //    text = '-- RECEIVING DATA: ' + EOL + content;
            //    break;
            //case infoTypes.DATA_OUT:
            //    text = '-- SENDING DATA: ' + EOL + content;
            //    break;
            //case infoTypes.SSL_DATA_IN:
            //    text = '-- RECEIVING SSL DATA: ' + EOL + content;
            //    break;
            //case infoTypes.SSL_DATA_OUT:
            //    text = '-- SENDING SSL DATA: ' + EOL + content;
            //    break;
        }
        if (text) {
            log(text)
        }

        return 0;
    };


//http://stackoverflow.com/a/904609/710693
// curl.setOpt(Curl.option.URL, '10.255.255.1');
    curl.setOpt(Curl.option.URL, opts.uri);
    curl.setOpt(Curl.option.SSL_VERIFYHOST, 0);
    curl.setOpt(Curl.option.SSL_VERIFYPEER, 0);
    curl.setOpt(Curl.option.CONNECTTIMEOUT, 10);
    curl.setOpt(Curl.option.TIMEOUT, 30);
    //curl.setOpt(Curl.option.VERBOSE, 0);
    curl.setOpt(Curl.option.FOLLOWLOCATION, 1);
    curl.setOpt(Curl.option.MAXREDIRS, 10);
    curl.setOpt(Curl.option.AUTOREFERER, 1);

    curl.setOpt(Curl.option.COOKIEFILE, cookieJarFile);
    curl.setOpt(Curl.option.COOKIEJAR, cookieJarFile);


    //console.log(util.inspect(process.versions));
    //console.log(util.inspect(Curl.getVersion()));

    let acceptedMimeTypes = opts.acceptedMimeTypes || constants.TEXT_MIME_TYPES

    curl.on('header', function (headerBuf) {
        //curl.onHeader = (function (headerBuf, size, nitems) {
        //log('HEADER', header.toString())
        let header = headerBuf.toString()
        //log(arguments)
        let parts = header.split(':')
        let hname = parts[0].toLowerCase()
        let val = _.trim(parts[1])
        let mime = _.trim(val.split(';')[0]);
        if (hname === 'content-type') {
            //log('MIME', mime)
            if (acceptedMimeTypes.indexOf(mime) === -1) {

                //we can't curl close here, so emit an error
                this.emit('error', 'UNHANDLED_MIMETYPE ' + mime)

                return;
            }
        }

    })

    curl.on('end', function (code, responseBody, headers) {

        let _responseBody = responseBody

        ee.emit(constants.EV_STATS, {
            type: 'CURL_COMPLETED',
            code,
            SIZE_DOWNLOAD: this.getInfo('SIZE_DOWNLOAD'),
            SPEED_DOWNLOAD: this.getInfo('SPEED_DOWNLOAD')
        })

        log(code, headers);
        const lastHeaders = headers[headers.length - 1]
        for (let hName in lastHeaders) {
            if ('' + hName.toLowerCase() === 'content-encoding') {
                if ('' + lastHeaders[hName].toLowerCase() === 'gzip') {
                    log("GZIPPED")
                    // log(_responseBody)
                }
            }
        }


        //for (var infoName in Curl.info) {
        //    if (Curl.info.hasOwnProperty(infoName) && infoName !== 'debug') {
        //        console.info(infoName, ': ', this.getInfo(infoName));
        //    }
        //}

        let uriAfterRedir = this.getInfo('EFFECTIVE_URL') || opts.uri
        var baseURI = uritools.getBase(uriAfterRedir)
        uriAfterRedir = uritools.normalize(uriAfterRedir, baseURI)
        if (opts.uri !== uriAfterRedir) {
            log(uriAfterRedir, '=>', baseURI)
            //TODO more logic, get last headers
        }

        //TODO return real url because we need it as a base
        d.resolve({
            totalTime: this.getInfo('TOTAL_TIME'),
            skip: false,
            dateCompleted: new Date(),
            initialURI: opts.uri,
            uri: uriAfterRedir,
            mimeType: ('' + this.getInfo('CONTENT_TYPE')).toLowerCase(),
            baseURI,
            code,
            responseBody: _responseBody,
            headers
        })

        this.close();
    });

    //there are multiple args, but we only handle the special mime err
    curl.on('error', function (error, code) {

        ee.emit(constants.EV_STATS, {
            type: 'CURL_ERROR',
            uri: opts.uri,
            error,
            code
        })

        //TODO emit event to cause sleep when connectivity fails
        //TODO reject on bandwidth exceeded

        if (error && _.startsWith('' + error, 'UNHANDLED_MIMETYPE')) {
            d.resolve({
                totalTime: 0,
                code: 'UNSUPPORTED_MIME',
                dateCompleted: new Date(),
                uri: opts.uri,
                initialURI: opts.uri,
                skip: true,
                responseBody: '',
                reason: error
            })

            //NOTE this is a fake error sent from the header callback
            //we can't this.close()
            return;
        }

        //on timeout return an empty response
        if (code === CURL_TIMEOUT_CODE) {
            d.resolve({
                totalTime: 0,
                code: 'TIMED_OUT',
                dateCompleted: new Date(),
                uri: opts.uri,
                initialURI: opts.uri,
                skip: false,
                responseBody: '',
                reason: error
            })
            this.close();
            return;
        }

        this.close();
        log(util.inspect(
            [].slice.call(arguments)
        ));
        let err = new Error('CURL_ERROR');
        err._meta = Array.prototype.slice.apply(arguments)
        d.reject(err)
    });

    curl.perform();

    return d.promise;
}

module.exports = fetch;