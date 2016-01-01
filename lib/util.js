const moment = require('moment')
const path = require('path')

function sqlDateTime(jsDate) {
    return moment(jsDate).format("YYYY-MM-DD HH:mm:ss")
}

/**
 * returns a runtime path suitable for temp files
 * @param domain
 * @param suffix
 * @returns {string}
 */
function getRuntimePath(domain, suffix) {

    //strip protocol if it's an URI
    let tmp = domain.split('://')
    let normDomain = tmp[1].replace(/\W+/g, '-');
    return path.join(__dirname, '/../runtime/' + normDomain + suffix);
}

module.exports = {
    sqlDateTime,
    getRuntimePath
}

