var spawn = require('child_process').spawn

const constants = require('./lib/constants')
const LOG_PREFIX = 'PROCESS MONITOR'
const log = require('./lib/logger').prefix(LOG_PREFIX);
const errlog = require('./lib/logger').error(LOG_PREFIX);

var child;
function spawnProcess() {
    child = spawn('node', ['runner.js'],{
        stdio:'inherit'
    })

    child.on('error', function (err) {
        console.log('Failed to start child process.');
    });

    child.on('close', function (code, signal) {
        log('CLI EXITED WITH', code)
        if (code === 100) {
            log('*** RESTART ***')
            setTimeout(spawnProcess,0)
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