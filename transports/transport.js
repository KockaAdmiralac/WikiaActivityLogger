/**
 * transport.js
 * This is a base class for other transport methods
 */
'use strict';

/**
 * Importing utility modules
 */
const io = require('../includes/io.js'), // jshint ignore: line
      util = require('../includes/util.js');

/**
 * Base class for other transports
 * @class Transport
 */
class Transport {
    /**
     * Class constructor
     * @constructor
     * @param {Object} config Transport configuration
     * @param {String} wikiname Subdomain of the wiki
     * @param {String} modul Module name
     * @throws {Error} If improperly called
     */
    constructor(config, wikiname, modul, strings) {
        if(typeof config !== 'object' || typeof wikiname !== 'string' || typeof modul !== 'string') {
            throw new Error(`Constructor parameters incorrectly supplied! (${modul || 'Transport'}.constructor)`);
        }
        this.modul = modul;
        this.wikiname = wikiname;
        this.config = config;
        this.strings = strings;
    }
    /**
     * Bot calls this method when it wants to send a message
     * through a transport.
     * @method send
     * @param {String} message The message to send
     * @throws {Error} If not implemented through subclasses
     */
    send(message) { // jshint ignore: line
        util.logError('`send` method not implemented!', this.modul, 'prototype.send');
    }
    /**
     * Parses the message from the wiki to fit the transport's needs
     * @method parse
     * @protected
     * @param {String} message The message to parse
     * @return {String} Parsed message
     */
    parse(message) {
        return message.replace(/{{([^\}]*)}}/g, (function(_, template) {
            let args = template.split('|');
            return this.template(args.splice(0, 1)[0], args);
        }).bind(this));
    }
    /**
     * Parses a {{template}}
     * @method template
     * @protected
     * @param {String} name Template name
     * @param {Array<String>} args Template arguments
     * @return {String} Parsed template
     */
    template(name, args) { // jshint ignore: line
        switch(name) {
            case 'diff':
            case 'link':
                break;
        }
    }
}

module.exports = Transport;
