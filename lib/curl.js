const LOG_PREFIX = 'CURL'
const log = require('./logger').prefix(LOG_PREFIX);
const errlog = require('./logger').error(LOG_PREFIX);

const fakePromise = require('./fakePromise')


function fetch(opts) {
    return fakePromise.resolve({
            uri: opts.uri,
            responseCode: 200,

            //incl headers
            response: '<body>'
        }
        , 1500
    )
}

module.exports = fetch;