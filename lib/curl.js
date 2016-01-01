//to build libcurl from the latest source
//http://askubuntu.com/questions/173085/how-do-i-build-libcurl-from-source

const moment = require('moment')
const _ = require('lodash')
const path = require('path')
const fs = require('fs')
var util = require('util')
const Q = require('q')
var Curl = require('node-libcurl').Curl

const LOG_PREFIX = 'CURL'
const log = require('./logger').prefix(LOG_PREFIX);
const errlog = require('./logger').error(LOG_PREFIX);
const fakePromise = require('./fakePromise')
const url = require('url')
const uritools = require('./uritools')

function fetch(opts) {

    let parsed = url.parse(opts.uri);
    let jarFile = parsed.host.replace(/\W+/g, '-') + '.txt';

    var d = Q.defer();
    var curl = new Curl();

    var cookieJarFile = path.join(__dirname, '/../runtime/' + jarFile);
    if (!fs.existsSync(cookieJarFile)) {
        fs.writeFileSync(cookieJarFile);
    }

    curl.setOpt(Curl.option.COOKIEFILE, cookieJarFile);
    curl.setOpt(Curl.option.COOKIEJAR, cookieJarFile);


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
    //curl.setOpt(Curl.option.VERBOSE, 1);
    //curl.setOpt(Curl.option.DEBUGFUNCTION, debugCallback);


    //log(Curl.option)

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
    //curl.setOpt( Curl.option.COOKIEFILE, '' )

    curl.setOpt(Curl.option.COOKIEFILE, cookieJarFile);
    curl.setOpt(Curl.option.COOKIEJAR, cookieJarFile);


    //console.log(util.inspect(process.versions));
    //console.log(util.inspect(Curl.getVersion()));

    let supportedTypes = [
        'text/html',
        'text/plain',
        'application/xhtml+xml'

    ]

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
            log('MIME', mime)
            if (supportedTypes.indexOf(mime) === -1) {

                //we can't curl close here, so emit an error
                this.emit('error', 'UNHANDLED_MIMETYPE ' + mime)

                return;
            }
        }

    })

    curl.on('end', function (code, responseBody, headers) {
        //log(code, headers);

        //for ( var infoName in Curl.info ) {
        //    if ( Curl.info.hasOwnProperty( infoName ) && infoName !== 'debug' ) {
        //        console.info( infoName, ': ', this.getInfo( infoName ) );
        //    }
        //}

        let uriAfterRedir = this.getInfo('EFFECTIVE_URL') || opts.uri
        var baseURI = uritools.getBase(uriAfterRedir)
        uriAfterRedir = uritools.normalize(uriAfterRedir, baseURI)
        log(uriAfterRedir, '=>', baseURI)

        this.close();
        //TODO return real url because we need it as a base
        d.resolve({
            skip: false,
            dateCompleted: new Date(),
            initialURI: opts.uri,
            uri: uriAfterRedir,
            baseURI,
            code,
            responseBody,
            headers
        })
    });

    //there are multiple args, but we only handle the special mime err
    curl.on('error', function (error) {

        //TODO skip on timeout

        if (error && _.startsWith('' + error, 'UNHANDLED_MIMETYPE')) {
            d.resolve({
                dateCompleted: new Date(),
                uri: opts.uri,
                skip: true,
                reason: error
            })
            return;
        }

        this.close();
        log(util.inspect(arguments));
        let err = new Error('CURL_ERROR');
        err._meta = arguments
        d.reject(err)
    });

    curl.perform();

    return d.promise;
}

module.exports = fetch;