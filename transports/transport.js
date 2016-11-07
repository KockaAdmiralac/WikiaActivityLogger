/**
 * transport.js
 * This is a template for making other transport methods
 * Rename 'Transport' to whatever you want when making your own transport
 */
'use strict';

/**
 * The instance of our IO helper object
 */
const io = require('../io.js');

var Transport = function(config, wikiname) {
    if(!(this instanceof Transport)) {
		throw new Error('This isn\'t a static class! (Transport.constructor)');
	}
    this.wikiname = wikiname;
    this.config = config;
};

/**
 * Bot calls this method when it wants to send a message
 * through a transport.
 * @param {String} message The message to send
 */
Transport.prototype.send = function(message) {
    //
};

module.exports = Transport; // jshint ignore: line
