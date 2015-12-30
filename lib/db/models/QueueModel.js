const constants = require('../../constants')
const hash = require('../../hash')
var db = require('../connect').getDB();
var orm = require('orm');

let props = {
    hash: {type: 'text', size: 32, index: true, unique: true, key: true},
    uri: {type: 'text', size: 2100},
    domain: {type: 'text', size: 255, index: true},
    excluded: {type: 'boolean', defaultValue: 0},
    state: {
        type: 'number',
        defaultValue: constants.URI.STATUS_UNCRAWLED,
        index: true
    },
    processedCounter: {type: 'number', defaultValue: 0},
    httpStatus: {type: 'number', defaultValue: null},
    // http://www.electrictoolbox.com/maximum-length-mysql-text-field-types/, next LONGTEXT is 16GB
    response: {type: 'text', big: true, size: 16777215},
    duration: {type: 'number'},
    dateLastCrawled: {type: 'date', defaultValue: null},
    dateAdded: {type: 'date', defaultValue: null}
}

var Queue = db.define(
    'uri_model', props, {
    validations: {
        uri: orm.validators.notEmptyString("[uri] not specified"),
        domain: orm.validators.notEmptyString("[domain] not specified"),
    },
    hooks: {
        beforeSave: function (next) {
            //console.log(this);
            if (!this.hash) {
                this.hash = hash(this.uri);
            }
            return next();
        }
    }

})

Queue._definition = props;
module.exports = Queue;