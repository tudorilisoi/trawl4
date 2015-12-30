//transpile at runtime
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

var factory = require('./lib/factory');

const LOG_PREFIX = 'CLI MAIN'
const log = require('./lib/logger').prefix(LOG_PREFIX);
const errlog = require('./lib/logger').error(LOG_PREFIX);

process.stdin.resume();//so the program will not close instantly

function exitHandler(options, err) {
    if (options.cleanup) log('cleanup');
    if (err) {
        errlog(err.stack);
    }
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

var s = factory.getSession({
    domain: 'http://www.eradauti.ro'
});

s.start();