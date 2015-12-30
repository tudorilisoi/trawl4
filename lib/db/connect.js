var orm = require('orm');
var Q = require('q');

var db = null;

function connect() {
    return Q.nfcall(orm.connect, 'mysql://root:root@localhost/trawl4').then((dbo)=> {
        db = dbo
        return db;
    });
}

function disconnect(cb) {
    if (db) db.close();
}

function sync(cb) {
    return db.sync(cb)
}

module.exports = {
    sync,
    connect,
    disconnect,
    getDB: ()=> {
        return db
    }
}
