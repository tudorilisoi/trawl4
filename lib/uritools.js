var url = require('url');
var _ = require('lodash');
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

function getRelative(uri) {
    var base = getBase(uri)
    return uri.substr(base.length)
}

/**
 * normalizes a query to avoid duplicate non-array params
 * @param query
 * @returns {*}
 */
function normalizeQuery(query) {
    if (!query) {
        return query
    }
    let queryStr = query.substr(1)
    let parts = queryStr.split('&')
    let tmp = []
    let seen = {}

    parts.forEach((p, i)=> {
        let varparts = p.split('=')
        let k = varparts[0]
        let v = varparts[1]
        if (k.indexOf('[]') === -1) {
            if (seen[k] === undefined) {
                seen[k] = tmp.length;
                tmp.push({k: k, v: v || null});
                //console.log('push', k, v, seen[k]);
            } else {
                //console.log('found', k, v, seen[k]);
                tmp[seen[k]] = {k: k, v: v || null}
            }
        } else {
            tmp.push({k: k, v: v || null});
        }

    })
    //console.log(parts, tmp, 'seen', seen);

    let ret = []
    _.each(tmp, (o)=> {
        ret.push(o.v ? o.k + '=' + o.v : o.k)
    })
    return ret.join('&')
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


    //double '?' in URI
    if (/\?.+\?/.test(uri)) {
        uri = uri.split('?')
        uri = uri[0] + '?' + uri[1];
    }

    var components = url.parse(uri, false);
    components.hash = null;
    //components.query = normalizeQuery(components.query)
    components.search = normalizeQuery(components.search)
    var ret = url.format(components);

    //check if within base
    if (components.hostname !== url.parse(base).hostname) {
        ret = null;
    }

    var low = components.href.toLowerCase();

    //these are useless binary files, so skip them
    if (
        //S.endsWith(low, '.jpg')
    //|| S.endsWith(low, '.jpeg')
    //|| S.endsWith(low, '.png')
    //|| S.endsWith(low, '.gif')
    S.endsWith(low, '.swf')
    || S.endsWith(low, '.flv')
    || S.endsWith(low, '.exe')
    || S.endsWith(low, '.rar')
    || S.endsWith(low, '.zip')
    || S.endsWith(low, '.7z')
    || S.endsWith(low, '.tar.gz')
    || S.endsWith(low, '.pdf')
    || S.endsWith(low, '.xls')
    || S.endsWith(low, '.csv')
    || S.endsWith(low, '.doc')
    || S.endsWith(low, '.docx')
    || S.endsWith(low, '.webp')

    ) {
        ret = null;
    }

    if (ret && S.endsWith(ret, '/')) {
        //console.log('*****************************')
        ret = ret.substring(0, ret.length - 1)
    }

    console.log(uri, ret);
    return ret
}

/**
 * URI utility functions
 * @type type
 */

var util = {
    getRelative,
    getBase: getBase,
    getDomain: getDomain,
    shorten: shorten,
    normalize: normalize
};

module.exports = util;