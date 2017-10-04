const cheerio = require('cheerio')
const sanitizehtml = require('sanitize-html')
const util = require('./util')

function removeEmptyLines(text) {
    return ('' + text).replace(/(^[ \t]*\n)/gm, '')
}

function removeNewLines(text) {
    return ('' + text).replace(/([\r\n])+/gm, '')
}


function textFromHTML(html) {
    let sanehtml = sanitizehtml(html, {
        allowedTags: sanitizehtml.defaults.allowedTags.concat(['div']),
        allowedAttributes: false,
        transformTags: {
            'div': 'p',
            'em': 'span',
            'strong': 'span',
        }
    })

    sanehtml = sanitizehtml(html, {
        allowedTags: [],
        allowedAttributes: [],
    })

    return removeEmptyLines(sanehtml || html)
}

const presets = {
    title: [textFromHTML, removeNewLines],
    body: [textFromHTML, removeEmptyLines],
}


function select(selector) {
    return this.$(selector)
}

function Parser(model, config) {
    this.model = model
    this.uri = model.uri
    this.config = config
}

Parser.prototype.run = function () {

    const model = this.model


    if (!model.mimeType || model.mimeType.indexOf('text/html') === -1) {
        return null
    }

    const excludedURIRegex = this.config.exclude || []
    for (let re of excludedURIRegex) {
        if (re.test(model.uri)) {
            return null
        }
    }

    this.$ = cheerio.load(model.response)

    this.ret = {}
    for (let field in this.config.data) {
        this.ret[field] = this.runConfig(this.config.data[field])
        console.log(`FIELD ${field}`);
        console.log(`>${this.ret[field]}<`);
    }
    return this.ret;
}

Parser.prototype.runConfig = function (config) {
    const c = config.slice(0)
    const selector = c.shift()
    let ret = null
    if ('' + selector === selector) {
        ret = select.call(this, selector)
    } else {
        ret = selector(ret, this)
    }
    for (let fn of c) {
        ret = fn(ret, this)
    }
    return ret
}


module.exports = {
    Parser,
    presets,
    removeEmptyLines,
    removeNewLines,
    textFromHTML,
}
