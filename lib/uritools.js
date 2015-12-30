var url = require('url');
function getDomain(uri) {
    return url.parse(uri).hostname;
}

function shorten(uri) {
    return url.parse(uri).path;
}

function getBase(uri) {
    var components = url.parse(uri);
    return components.protocol + '//' + components.hostname;
}

//base must have ending slash
function normalize(rawURI, baseURI) {
    var S = require('lodash');
    var uri = rawURI
    var base = baseURI
    if (S.endsWith(base, '/')) {
        base = base.substring(0, uri.length - 1)
    }

    if(uri==='/'){
        return base;
    }

    if (S.endsWith(uri, '/')) {
        uri = uri.substring(0, uri.length - 1)
    }
    if (S.startsWith(uri, '/')) {
        uri = uri.substring(1)
    }


    var isAbsolute = S.startsWith(uri, 'http://') || S.startsWith(uri, 'https://');
    if (!isAbsolute) {
        uri = base + '/' + uri
    }

    var components = url.parse(uri);
    components.hash = null;
    var ret = url.format(components);

    if (components.hostname !== url.parse(base).hostname) {
        ret = null;
    }

    var low = components.href.toLowerCase();
    if (
        S.endsWith(low, '.jpg')
        || S.endsWith(low, '.jpeg')
        || S.endsWith(low, '.png')
        || S.endsWith(low, '.gif')
        || S.endsWith(low, '.swf')
        || S.endsWith(low, '.pdf')
        || S.endsWith(low, '.xls')
        || S.endsWith(low, '.csv')
        || S.endsWith(low, '.doc')
        || S.endsWith(low, '.webp')

    ) {
        ret = null;
    }

    console.log(base, uri, ret);
    return ret


    var urlUtil = require('url');
    var canonic = S.trim(uri + '');
    var components;
    var ret = null;
    //TODO strangely enough the base uri is not returned
    if (uri === '/') {
        return base;
    }
    //rel to abs
    var isAbsolute = S.startsWith(uri, 'http://') || S.startsWith(uri, 'https://');
    if (!isAbsolute) {
        canonic = base + (uri.startsWith('/') ? uri.substring(1) : uri)
    }
    components = urlUtil.parse(canonic);
    components.hash = null;
    ret = urlUtil.format(components);
    var low = components.href.toLowerCase();
    if (
        S.endsWith(low, '.jpg')
        || S.endsWith(low, '.jpeg')
        || S.endsWith(low, '.png')
        || S.endsWith(low, '.gif')
        || S.endsWith(low, '.swf')
        || S.endsWith(low, '.pdf')
        || S.endsWith(low, '.xls')
        || S.endsWith(low, '.csv')
        || S.endsWith(low, '.doc')
        || S.endsWith(low, '.webp')

    ) {
        ret = null;
    }

    if (components.hostname !== urlUtil.parse(base).hostname) {
        ret = null;
    }
    return ret;
}

/**
 * URI utility functions
 * @type type
 */

var util = {
    getBase: getBase,
    getDomain: getDomain,
    shorten: shorten,
    normalize: normalize
};

module.exports = util;