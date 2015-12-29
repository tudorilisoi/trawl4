const Q = require('q');
const DEFAULT_DELAY = 1000;

function resolve(val, delay) {
    let millis = delay || DEFAULT_DELAY
    var d = Q.defer();
    setTimeout(()=> {
        d.resolve(val)
    }, millis)
}

function reject(val, delay) {

}

module.exports = {
    resolve,
    reject
}
