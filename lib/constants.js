const EV_STORAGE_CONNECTED = 'EV_STORAGE_CONNECTED'
const EV_SHUTDOWN = 'EV_SHUTDOWN'
const EV_BOOT = 'EV_BOOT'
const EV_STATS = 'EV_STATS'
const EV_CRAWL_NEXT = 'EV_CRAWL_NEXT'
const EV_STORAGE_REQUEST_DISCONNECT = 'EV_STORAGE_REQUEST_DISCONNECT'
const CRAWL_MODE = 'CRAWL_MODE'
const RECRAWL_MODE = 'RECRAWL_MODE' //not used ATM
const PROCESS_MODE = 'PROCESS_MODE'
const QUEUE_FINISHED = 'QUEUE_FINISHED'
const LRU_CACHE_SIZE = 20000
const CRAWL_DELAY = 4000
const EXIT_CODE_FOR_RESTART = 100
const URL_COUNT_FOR_RESTART = 100
const URL_COUNT_FOR_PROCESS = 300
const USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Ubuntu Chromium/47.0.2526.73 Chrome/47.0.2526.73 Safari/537.36'

const TEXT_MIME_TYPES = [
    'text/html',
    'text/plain',
    'application/xhtml+xml'
]

const IMAGE_MIME_TYPES = [
    'image/jpeg',
    'image/jpg',
    'image/png',
]

const DEFAULT_PARSER_CLASS = {
    includeRegexArr: [],
    excludeRegexArr: [],
    chunks: {
        images: {
            cssSelector: null
        }
    }
}

module.exports = {
    TEXT_MIME_TYPES,
    IMAGE_MIME_TYPES,
    DEFAULT_PARSER_CLASS,
    USER_AGENT,
    EV_CRAWL_NEXT,
    EV_SHUTDOWN,
    EV_BOOT,
    EV_STATS,
    URL_COUNT_FOR_RESTART,
    EXIT_CODE_FOR_RESTART,
    CRAWL_DELAY,
    LRU_CACHE_SIZE,
    QUEUE_FINISHED,
    EV_STORAGE_REQUEST_DISCONNECT,
    EV_STORAGE_CONNECTED,
    CRAWL_MODE,
    PROCESS_MODE,
    URL_COUNT_FOR_PROCESS,
    RECRAWL_MODE,
    URI: {
        STATUS_UNCRAWLED: 0,
        STATUS_CRAWLED: 100,
    }
}
