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
        type: 'integer',
        unsigned: true,
        size: 4,
        defaultValue: constants.URI.STATUS_UNCRAWLED,
        index: true
    },
    processedCounter: {type: 'integer', defaultValue: 0, unsigned: true},
    mimeType: {type: 'text', size: 255, defaultValue: null},
    httpStatus: {type: 'text', size: 30, defaultValue: null, index: true},
    // http://www.electrictoolbox.com/maximum-length-mysql-text-field-types/, next LONGTEXT is 16GB
    response: {type: 'text', big: true, size: 16777215},
    duration: {type: 'integer', unsigned: true},
    dateLastCrawled: {type: 'date', time: true, defaultValue: null},
    dateAdded: {type: 'date', time: true, defaultValue: null}
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