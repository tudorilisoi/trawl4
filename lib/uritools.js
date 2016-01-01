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
    var uri = S.trim(rawURI)
    var base = baseURI

    if (!uri) {
        return null
    }

    //normalize base
    if (S.endsWith(base, '/')) {
        base = base.substring(0, base.length - 1)
    }
    if (
        S.startsWith(uri, 'mailto:')
        || S.startsWith(uri, 'tel:')
        || S.startsWith(uri, 'javascript:')
        || S.startsWith(uri, 'ftp://')

    ) {
        return null
    }

    if (uri === '/') {
        return base;
    }

    //protocol relative URI
    if (S.startsWith(uri, '//')) {
        uri = url.parse(base).protocol + uri
    }

    //strip slashes
    if (S.startsWith(uri, '/')) {
        uri = uri.substring(1)
    }

    //make it absolute
    var isAbsolute = S.startsWith(uri, 'http://') || S.startsWith(uri, 'https://');
    if (!isAbsolute && uri) {
        uri = base + '/' + uri
    }

    var components = url.parse(uri);
    components.hash = null;
    var ret = url.format(components);

    //check if within base
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

    if (ret && S.endsWith(ret, '/')) {
        //console.log('*****************************')
        ret = ret.substring(0, ret.length - 1)
    }
    //console.log(base, uri, ret);
    return ret
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