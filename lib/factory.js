var Session = require('./Session');

function getSession(opts) {
    return new Session(opts);
}

export   {
    getSession
}

