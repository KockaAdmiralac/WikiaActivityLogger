/**
 * index.js
 * Module for transferring messages through [Discord](https://discordapp.com)
 */
'use strict';

/**
 * Importing modules
 */
const io = require('../../includes/io.js'),
      util = require('../../includes/util.js'),
      Transport = require('../transport.js');

/**
 * Transport class
 * @class Discord
 * @augments Transport
 */
class Discord extends Transport {
    /**
     * Class constructor
     * @constructor
     */
    constructor(config, info, strings) {
        config.type = config.type || 'webhook';
        super(config, info, 'Discord', strings);
        if(typeof config.url === 'string') {
            this.url = config.url;
        } else if(typeof config.id === 'string' && typeof config.token === 'string') {
            this.url = `https://discordapp.com/api/${config.type === 'bot' ?
                `channels/${config.id}/messages?token=${config.token}` :
                `webhooks/${config.id}/${config.token}`
            }`;
        }
        this.queue = [];
    }
    /**
     * Bot calls this method when it wants to send a message
     * through a transport.
     * @method send
     * @param {String} message Message to send
     */
    send(message) {
        if(this.rateLimit) {
            this.queue.push(message);
        } else {
            const format = this._formatMessage(message);
            if(typeof format !== 'string') {
                // An error occurred while parsing
                return;
            }
            io.post(this.url, {
                content: this.parse(format)
            }, undefined, true)
                .catch((function(error) {
                    switch(error.statusCode) {
                        case 429:
                            this.rateLimit = true;
                            this.queue.push(message);
                            setTimeout((function() {
                                this.rateLimit = false;
                                this.queue.forEach(function(el) {
                                    this.send(el);
                                }, this);
                                this.queue = [];
                            }).bind(this), error.error.retry_after);
                            break;
                        default:
                            main.hook('throw', error);
                    }
                }).bind(this));
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
        console.log( String( arg ) );
        return String(arg)
            .replace(/\{/g, '\\{')
            .replace(/\}/g, '\\}')
            .replace(/\|/g, 'I'); // ehhh
    }
    /**
     * Breaks HTTP using zero-width spaces
     * This is so Discord doesn't generate previews but the
     * link displays rather normally
     * @method _escapeLink
     * @private
     * @param {String} link Link to escape
     * @return {String} Escaped link
     */
    _escapeLink(link) {
        return link
            .replace(/http:\/\//g, 'http:/​/')
            .replace(/https:\/\//g, 'https:/​/');
    }
    /**
     * Escapes markdown syntax
     * @method _escapeMarkdown
     * @private
     * @param {String} message Message to escape
     * @return {String} Escaped message
     * @todo Not finished yet
     */
    _escapeMarkdown(message) {
        console.log( message );
        return message
            .replace(/\@/g, '@​') // prevent @everyone and @here
            .replace(/discord\.gg/g, 'discord.gg​') // zero-width space
            .replace(/_{1,2}([^_*]+)_{1,2}/g, '$1')
            .replace(/\*{1,2}([^_*]+)\*{1,2}/g, '$1')
            .replace(/\r?\n|\r/g, '​');
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
     * Creates a markdown link ([text](link))
     * @method _mdLink
     * @private
     * @param {String} link Link to point to
     * @param {String} text Text to mask the link with
     * @return {String} Markdown-formatted masked link
     */
    _mdLink(link, text) {
        return `[${this._escapeMarkdown(text)}](<${link.replace(/\)/g, '%29')}>)`;
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
        switch(name) {
            case 'diff':
                const general = this.info.general;
                return `(${this._mdLink(util.linkToDiff(general.server, general.scriptpath, args[0]), this.strings.diff)})`;
            case 'diffSize':
                const bold = '*'.repeat((args[0] > 1000 || args[0] < -1000) ? 2 : 1);
                if(args[0] > 0) {
                    args[0] = `+${args[0]}`;
                }
                return `${bold}(${args[0]})${bold}`;
            case 'user':
                return `${this._mdLink(this._link(`User:${args[0]}`), args[0])} (${this._mdLink(this._link(`User talk:${args[0]}`), this.strings.talk)}|${this._mdLink(this._link(`Special:Contributions/${args[0]}`), this.strings.contribs)})`;
            case 'link':
                return this._mdLink(this._link(args[0]), (args[1] || args[0]));
            case 'userlink':
                return this._mdLink(this._link(args[0]), args[0].split(':')[1]);
            case 'summary':
                const a = args[0].trim();
                return (a.length === 0) ? '' : `(*${this._escapeLink(this._escapeMarkdown(a))}*)`;
            case 'debug':
                return `\`\`\`${args[0]}\`\`\``;
            case 'wiki':
                return `<http://${args[0]}>`;
            case 'board':
                return this._mdLink(this._link(`${this.info.namespaces[args[0] - 1]['*']}:${args[1]}`), this._formatMessage([`board-${args[0]}`, args[1]]));
        }
    }
}

module.exports = Discord;
