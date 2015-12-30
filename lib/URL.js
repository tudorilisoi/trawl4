const url = require('url')

function getBase(uri) {
    console.log(url.parse(uri))
}


module.exports = {
    getBase
}
