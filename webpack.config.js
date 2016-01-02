var webpack = require('webpack');
var path = require('path');
var fs = require('fs');
var _ = require('lodash');

var nodeModules = {};
fs.readdirSync('node_modules')
    .filter(function (x) {
        return ['.bin'].indexOf(x) === -1;
    })
    .forEach(function (mod) {
        nodeModules[mod] = 'commonjs ' + mod;
    });

module.exports = {
    entry: './runner.js',
    target: 'node',
    output: {
        path: path.join(__dirname, 'dist'),
        filename: 'runner.js'
    },
    node: { __dirname: true },

    //https://webpack.github.io/docs/library-and-externals.html
    externals: _.extend({
        'babel-core': 'commonjs babel-core',
        'babel-loader': 'commonjs babel-loader',
        classnames: 'commonjs classnames',
    }, nodeModules),
    module: {

        loaders: [
            {
                test: /\.js|\.tag$/,
                exclude: /node_modules/,
                include: /lib/,
                loader: 'babel',
                //query: {modules: 'common'}
            },
        ]
    },
}
