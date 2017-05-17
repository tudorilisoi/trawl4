module.exports = {
    domain: 'http://www.culinar.ro',
    crawlDelay: 3000,
    includeRegexArr: [
        /^$/, //base URI
        /^\/retete\//,
        ///^\/recipe\/gallery\//, //pics, include them only when parsing

    ],
    excludeRegexArr: [
        /^\/retete\/bauturi\//,
        /^\/retete\/culinare\?pagina=/, //redundant
        /recipes=/,
        /filterdata=/,

    ],
    parserClasses: {
        regexArr: [],
        chunkName: 'title',
        cssSelector: ''
    }
}
