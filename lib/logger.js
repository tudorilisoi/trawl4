var debug = require('debug');
var _ = require('lodash');


function pad(str){
    return str;
    return _.padLeft(str, 15, ' ')
}

debug.enable('*')
//debug.enable(pad('SESSION'))

function prefix(prefix) {
    var padpre = pad(prefix)
    return debug(padpre);
}

function error(prefix) {
    var padpre = pad('ERROR ')
    return debug(padpre + prefix);
}

module.exports = {
    prefix,
    error
};
