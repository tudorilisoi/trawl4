const Q = require('q')

var robots = require('robots')


// for example:
//
// $ curl -s http://nodeguide.ru/robots.txt
//
// User-agent: Google-bot
// Disallow: /
// Crawl-delay: 2
//
// User-agent: *
// Disallow: /
// Crawl-delay: 2


function getParser(ua, domain) {
    var d = Q.defer();

    var parser = new robots.RobotsParser(
        domain + '/robots.txt',
        ua,
        function (parser, success) {
        console.log('p',parser);
        d.resolve({
            getCrawlDelay: ()=> {
                if (!success) {
                    return null
                }
                return parser.getCrawlDelay(ua)
            },
            isAllowed: (uri)=> {
                if (!success) {
                    return true;
                }
                return parser.canFetchSync(ua, uri)
            }
        })
    });
    return d.promise
}


module.exports = getParser
