module.exports = {
    domain: 'https://www.culinar.ro',
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
        /\?picture=/,
        /\?utm_campaign=/,
        /filterdata=/,

    ],
    parserClasses: {
        regexArr: [],
        chunkName: 'title',
        cssSelector: ''
    }
}
