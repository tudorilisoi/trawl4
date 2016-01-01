const moment = require('moment')

function sqlDateTime(jsDate){
    return moment(jsDate).format("YYYY-MM-DD HH:mm:ss")
}

module.exports = {
    sqlDateTime
}

