var Logger = require('./Logger');
var Session = require('./Session');

function getLogger(prefix) {
    return new Logger();
}

function getSession(opts) {
    return new Session(opts);
}


export   {
    getLogger,
    getSession
}

