/**
 * index.js
 * Module for transferring messages through desktop notifications
 */
'use strict';

/**
 * Importing modules
 */
const io = require('../../includes/io.js'),
    util = require('../../includes/util.js'),
    Transport = require('../transport.js'),
    notifier = require('node-notifier'),
    opn = require('opn');


/**
 * Transport class
 * @class Notifications
 * @augments Transport
 */
class Notifications extends Transport {
    /**
     * Class constructor
     * @constructor
     */

    constructor(data, info, strings) {
        super(data, info, 'Notifications', strings);
    }

    /**
     * Bot calls this method when it wants to send a message
     * through a transport.
     * @method send
     * @param {String} message Message to send
     */
    send(message) {
        const format = this._formatMessage(message),
              wikiname = this.config.name || this.info.general.sitename;
        notifier.notify({
            title: `WikiaActivityLogger - ${wikiname}`,
            message: this.parse(format),
            wait: true
        });
        if (this.diff) {
            let diffLink = `${this.info.general.server}/?diff=${this.diff}`;
            notifier.on('click', (notifierObject, options) => opn(diffLink));
            this.diff = null;
        }
    }

    /**
     * Preprocesses the argument passed to the template
     * @method preprocess
     * @param {String} arg
     * @return {String} Preprocessed argument
     * @throws {Error} If not implemented through subclasses
     */
    preprocess(arg) {
        return String(arg)
            .replace(/\{/g, '\\{')
            .replace(/\}/g, '\\}')
            .replace(/\|/g, 'I');
    }

    /**
     * Shorthand for util.linkToArticle
     * @method _link
     * @private
     * @param {String} page Page to link to
     * @return {String} Link to the page
     */
    _link(page) {
        const general = this.info.general;
        return util.linkToArticle(general.server, general.articlepath, page);
    }

    /**
     * Parses a {{template}}
     * @method template
     * @protected
     * @param {String} name Template name
     * @param {Array<String>} args Template arguments
     * @return {String} Parsed template
     */
    template(name, args) {
        switch (name) {
            case 'diff':
                this.diff = args[0];
                return '';
            case 'diffSize':
                return `(${args[0]})`;
            case 'user':
            case 'link':
            case 'userlink':
                return args[0];
            case 'summary':
                const a = args[0].trim().replace(/\n/g, '');
                return (a.length === 0) ? '' : `(${a})`;
            case 'debug':
                return `\`\`\`${args[0]}\`\`\``;
            case 'wiki':
                return `http://${args[0]}`;
            case 'board':
                return `${this.info.namespaces[args[0] - 1]['*']}:${args[1]}`, this._formatMessage([`board-${args[0]}`, args[1]]);
        }
    }

}

module.exports = Notifications;
