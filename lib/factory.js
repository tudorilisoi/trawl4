var Session = require('./Session');

var sesscount=0;

function getSession(opts) {
    opts.uid = sesscount++;
    return new Session(opts);
}

export   {
    getSession
}

