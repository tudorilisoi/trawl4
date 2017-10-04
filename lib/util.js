const moment = require('moment')
const _ = require('lodash')
const path = require('path')
const constants = require('./constants')


function sqlDateTime(jsDate) {
    return moment(jsDate).format("YYYY-MM-DD HH:mm:ss")
}

/**
 * returns a runtime path suitable for temp files
 * @param domain
 * @param suffix
 * @returns {string}
 */
function getRuntimePath(domain, suffix) {

    //strip protocol if it's an URI
    let tmp = domain.split('://')
    let normDomain = tmp[1].replace(/\W+/g, '-');
    return path.join(__dirname, '/../runtime/' + normDomain + suffix);
}

//sample mime: text/html; charset=utf8
function normalizeMime(mime) {
    let normalized = ('' + mime).split(';')
    normalized = _.trim(normalized[0])
    return normalized
}

function isTextMime(mime) {
    let normalized = normalizeMime(mime)
    return constants.TEXT_MIME_TYPES.indexOf(normalized) !== -1
}

function isImageMime(mime) {
    let normalized = normalizeMime(mime)
    return constants.IMAGE_MIME_TYPES.indexOf(normalized) !== -1
}

//instroduces ellipsis in the middle
function shortenString(str, max = 50,interstitial='[...]') {
    let f = parseInt(max/3-3)
    let head = f
    let tail = f*2
    if (str.length > max) {
        return str.substr(0, head) + interstitial + str.substr(str.length - tail, str.length);
    }
    return str;
}


function deepProp(o, s) {
    s = s.replace(/\[(\w+)\]/g, '.$1'); // convert indexes to properties
    s = s.replace(/^\./, '');           // strip a leading dot
    var a = s.split('.');
    for (var i = 0, n = a.length; i < n; ++i) {
        var k = a[i];
        if (k in o) {
            o = o[k];
        } else {
            return;
        }
    }
    return o;
}
/**
 * prevents v8 from keeping the original large string
 *
 * https://github.com/cheeriojs/cheerio/issues/263
 * @param str
 */
function unleakString(str) {
    return (' ' + str).substr(1)
}

function matchesOne(str, regexArr) {

    let isMatch = regexArr.some((re) => {
        return !!re.test(str);
    })
    return isMatch
}

module.exports = {
    matchesOne,
    deepProp,
    shortenString,
    normalizeMime,
    isTextMime,
    isImageMime,
    sqlDateTime,
    getRuntimePath,
    unleakString,
}

