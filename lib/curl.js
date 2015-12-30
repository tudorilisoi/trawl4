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

    //log(Curl.option)

//http://stackoverflow.com/a/904609/710693
// curl.setOpt(Curl.option.URL, '10.255.255.1');
    curl.setOpt(Curl.option.URL, opts.uri);
    curl.setOpt(Curl.option.CONNECTTIMEOUT, 10);
    curl.setOpt(Curl.option.VERBOSE, 0);
    curl.setOpt(Curl.option.FOLLOWLOCATION, 1);
    curl.setOpt(Curl.option.MAXREDIRS, 10);
    curl.setOpt(Curl.option.AUTOREFERER, 1);
    //curl.setOpt( Curl.option.COOKIEFILE, '' )

    curl.setOpt(Curl.option.COOKIEFILE, cookieJarFile);
    curl.setOpt(Curl.option.COOKIEJAR, cookieJarFile);

    //console.log(util.inspect(process.versions));
    //console.log(util.inspect(Curl.getVersion()));

    curl.on('end', function (code, responseBody, headers) {
        log(code, headers);
        d.resolve({code, responseBody, headers})
        this.close();
    });

    curl.on('error', function () {
        log(util.inspect(arguments));
        this.close();
    });

    curl.perform();

    return d.promise;
}

module.exports = fetch;