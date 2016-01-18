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
    return constants.IMAGE_MIME_TYPES.indexOf(mime) !== -1
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

module.exports = {
    deepProp,
    normalizeMime,
    isTextMime,
    isImageMime,
    sqlDateTime,
    getRuntimePath
}

