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
function normalize(uri, base) {
    var S = require('lodash');
    var urlUtil = require('url');
    var canonic = S.trim(uri + '');
    var components;
    var ret = null;
    if (uri === '/') {
        uri = base;
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