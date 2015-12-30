'use strict';
const util = require('util');
const EventEmitter = require('events');

function EventBus() {
    // Initialize necessary properties from `EventEmitter` in this instance
    EventEmitter.call(this);
}

// Inherit functions from `EventEmitter`'s prototype
util.inherits(EventBus, EventEmitter);

module.exports =  new EventBus();