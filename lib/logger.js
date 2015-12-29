var debug = require('debug');

debug.enable('*')
//debug.enable('SESSION')

function prefix(prefix) {
    return debug(prefix);
}

function error(prefix) {
    return debug('ERROR: ' + prefix);
}

module.exports = {
    prefix,
    error
};
