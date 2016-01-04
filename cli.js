//cheerio or orm2 are causing memory leaks,
// so restart the app when it self-closes with a special exit code

var spawn = require('child_process').spawn

const constants = require('./lib/constants')
const LOG_PREFIX = 'PROCESS MONITOR'
const log = require('./lib/logger').prefix(LOG_PREFIX);
const errlog = require('./lib/logger').error(LOG_PREFIX);

var child;
var timeout;
function spawnProcess() {

    //log(process.argv)
    //process.exit();

    //https://nodejs.org/api/child_process.html#child_process_child_process_spawn_command_args_options
    child = spawn('node', ['--expose-gc', 'runner.js'].concat(process.argv.slice(2)), {
        stdio: [process.stdin, process.stdout, process.stderr]
    })

    var handled = false;
    child.on('error', function (err) {
        errlog('Failed to start child process.', err, err.stack);
    });

    child.on('close', function (code, signal) {
        log('CLI EXITED WITH', code)

        //TODO start parsing when code is 200
        if (code === 100) {
            log('*** RESTART ***')
            clearTimeout(timeout)
            timeout = setTimeout(spawnProcess, 500)
        }
    })
    //child.stdout.on('data', function (data) {
    //    console.log(data.toString());
    //});
    //
    //child.stderr.on('data', function (data) {
    //    console.log(data.toString());
    //});

}


spawnProcess()