var debug = require('debug');
var _ = require('lodash');

//debug.enable('*')
debug.enable('SESSION')

function prefix(prefix) {
    var padpre = _.padLeft(prefix, 15, ' ')
    return debug(padpre);
}

function error(prefix) {
    var padpre = _.padLeft('ERROR ', 15, ' ')
    return debug(padpre + prefix);
}

module.exports = {
    prefix,
    error
};
