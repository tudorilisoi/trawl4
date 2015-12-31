const Q = require('q');
const DEFAULT_DELAY = 1000;

function resolve(val, delay) {
    let millis = delay || DEFAULT_DELAY
    var d = Q.defer();
    setTimeout(()=> {
        d.resolve(val)
    }, millis)
    return d.promise
}

function reject(val, delay) {
    let millis = delay || DEFAULT_DELAY
    var d = Q.defer();
    setTimeout(()=> {
        d.reject(val)
    }, millis)
    return d.promise
}

//used for mocking async operations
module.exports = {
    resolve,
    reject
}
