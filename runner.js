//transpile at runtime
//*
require("babel-core/register")({
    // Optional ignore regex - if any filenames **do** match this regex then they
    // aren't compiled.
    // ignore: /regex/,

    // Ignore can also be specified as a function.
    // ignore: function(filename) {
    //   if (filename === '/path/to/es6-file.js') {
    //     return false;
    //   } else {
    //     return true;
    //   }
    // },

    // Optional only regex - if any filenames **don't** match this regex then they
    // aren't compiled
    // only: /my_es6_folder/,

    // Setting this will remove the currently hooked extensions of .es6, `.es`, `.jsx`
    // and .js so you'll have to add them back if you want them to be used again.
    extensions: [".es6", ".es", ".jsx", ".js"]
});
//*/

const yargs = require('yargs');
const factory = require('./lib/factory');
const constants = require('./lib/constants')

const LOG_PREFIX = 'RUNNER'
const log = require('./lib/logger').prefix(LOG_PREFIX);
const errlog = require('./lib/logger').error(LOG_PREFIX);

process.stdin.resume();//so the program will not close instantly

function exitHandler(options, err) {
    if (options.cleanup) log('cleanup');
    if (err) {
        errlog(err, err.stack);
    }
    const ee = require('./lib/eventBus');
    ee.emit(constants.EV_STORAGE_REQUEST_DISCONNECT)
    ee.emit(constants.EV_SHUTDOWN)
    log('exiting')
    if (options.exit) process.exit();
}

//do something when app is closing
process.on('exit', exitHandler.bind(null, {cleanup: true}));

//catches ctrl+c event
process.on('SIGINT', exitHandler.bind(null, {exit: true}));

//catches uncaught exceptions
process.on('uncaughtException', exitHandler.bind(null, {exit: true}));


//console.log(factory);

var argv = require('yargs').argv;
var preset = argv.preset;

if (!preset) {
    log(
        `
    Usage: node cli.js --preset=[preset].
    Presets are stored in ./config, no extension needed

    `)
    process.exit();
}



try {
    //var conf = require('./config/' + preset)
    var conf = require("./config/" + preset + '.js')
} catch (e) {
    errlog(e, e.stack)
    process.exit();
}

var mergedConf = Object.assign({
    mode: constants.CRAWL_MODE
}, conf)

var s = factory.getSession(mergedConf)

/*
 var s = factory.getSession({
 //domain: 'http://retete.unica.ro',
 //domain: 'http://www.eradauti.ro',
 domain: 'http://www.gustos.ro',
 //startURI: 'http://v2.eradauti.ro/foto-radauti/mini-41942-vand-samsung-galaxy-s6-gold-56837eeae31f0.jpg',
 //domain: 'http://www.culinar.ro',
 mode: constants.CRAWL_MODE

 });
 //*/

s.start();