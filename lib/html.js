var cheerio = require("cheerio");

/**
 * prevents v8 from keeping the original large string
 *
 * https://github.com/cheeriojs/cheerio/issues/263
 * @param str
 */
function unleakString(str) {
    return (' ' + str).substr(1)
}

function getLinks(htmlStr) {
    var $ = cheerio.load(htmlStr);
    var ret = [];
    $('a').each((i, l)=> {
        ret.push(unleakString(
            $(l).attr('href')
        ))
    });
    return ret;
}

function bySelector(htmlStr, selector, attr) {
    var $ = cheerio.load(htmlStr);
    var ret = [];
    $(selector).each((i, l)=> {
        ret.push(unleakString(
            attr ? $(l).attr(attr) : $(l).html()
        ))
    });
    return ret;
}


module.exports = {
    bySelector,
    getLinks
}
