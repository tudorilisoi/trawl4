const crypto = require('crypto');

function hash(value) {
    return crypto.createHash('md5').update(value).digest("hex")
}

module.exports = hash;
