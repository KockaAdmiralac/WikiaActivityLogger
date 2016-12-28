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
     * @param {String} info Information about the wiki
     * @param {String} modul Module name
     * @param {Object} strings Strings data
     * @throws {Error} If improperly called
     */
    constructor(config, info, modul, strings) {
        if(typeof config !== 'object' || typeof info !== 'object' || typeof modul !== 'string') {
            throw new Error(`Constructor parameters incorrectly supplied! (${modul || 'Transport'}.constructor)`);
        }
        this.modul = modul;
        this.info = info;
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
        main.hook('error', '`send` method not implemented!', this.modul, 'prototype.send');
        throw new Error('`send` method not implemented!');
    }
    /**
     * Shorthand for util.format with some validation
     * @method _formatMessage
     * @private
     * @param {Array<String>} args Arguments of the message
     * @return {String} Formatted message
     */
    _formatMessage(args) {
        if(!(args instanceof Array)) {
            main.hook('error', 'Given arguments aren\'t an array', this.modal, 'prototype._formatMessage');
            return;
        }
        let msg = this.strings[args.splice(0, 1)[0]];
        if(typeof msg !== 'string') {
            main.hook('error', 'Given message isn\'t a string', this.modul, 'prototype._formatMessage');
            return;
        }
        return util.format(msg, args.map(this.preprocess));
    }
    /**
     * Preprocesses the argument passed to the template
     * @method preprocess
     * @param {String} arg
     * @return {String} Preprocessed argument
     * @throws {Error} If not implemented through subclasses
     */
    preprocess(arg) { // jshint ignore: line
        main.hook('error', '`preprocess` method not implemented!', this.modul, 'prototype.send');
        return;
    }
    /**
     * Parses the message from the wiki to fit the transport's needs
     * @method parse
     * @protected
     * @param {String} message The message to parse
     * @return {String} Parsed message
     */
    parse(message) {
        return message.replace(/\\}/g, '').replace(/{{([^\}]*)}}/g, (function(_, template) {
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
