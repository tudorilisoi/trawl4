var webpack = require('webpack');
var path = require('path');
var fs = require('fs');

var nodeModules = {};
fs.readdirSync('node_modules')
    .filter(function (x) {
        return ['.bin'].indexOf(x) === -1;
    })
    .forEach(function (mod) {
        nodeModules[mod] = 'commonjs ' + mod;
    });

module.exports = {
    entry: './cli.js',
    target: 'node',
    output: {
        path: path.join(__dirname, 'runtime'),
        filename: 'cli.js'
    },
    externals: nodeModules,
    module: {

        loaders: [
            {
                test: /\.js|\.tag$/,
                exclude: /node_modules/,
                include: /lib/,
                loader: 'babel-loader',
                query: {modules: 'common'}
            },
        ]
    },
}
