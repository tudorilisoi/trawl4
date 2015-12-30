var cheerio = require("cheerio");

function getLinks(htmlStr) {
    var $ = cheerio.load(htmlStr);
    var ret = [];
    $('a').each((i,l)=> {
        ret.push($(l).attr('href'))
    });
    return ret;
}

module.exports = {
    getLinks
}
