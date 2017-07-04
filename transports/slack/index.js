/**
 * index.js
 * Module for transferring messages through [Slack](https://slack.com)
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
 * @class Slack
 * @augments Transport
 */
class Slack extends Transport {
    /**
     * Class constructor
     * @constructor
     */
    constructor(config, info, strings) {
        config.type = config.type || 'webhook';
        super(config, info, 'Slack', strings);
        if(typeof config.url !== 'string') {
            main.hook('error', 'Slack webhook URL must be supplied!', 'Slack', 'constructor');
        }
        this.url = config.url;
    }
    /**
     * Bot calls this method when it wants to send a message
     * through a transport.
     * Does not care about rate limits because Slack's rate limits
     * are extremely high from what tests have proven
     * @method send
     * @param {String} message Message to send
     */
    send(message) {
        const format = this._formatMessage(message);
        if(typeof format !== 'string') {
            // An error occurred while parsing
            return;
        }
        io.post(this.url, {
            text: this.parse(format)
        }, undefined, true);
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
            .replace(/\|/g, 'I') // ehhh
            .replace(/\@(?!comment)/, '@​'); // prevent @everyone and @here
    }
    /**
     * Escapes mrkdwn syntax
     * Yeah, even Slack calls it mrkdwn instead of markdown
     * Don't believe me? Look at the end of https://api.slack.com/docs/message-formatting
     * @method _escapeMrkdwn
     * @private
     * @param {String} message Message to escape
     * @return {String} Escaped message
     * @todo Not finished yet
     */
    _escapeMrkdwn(message) {
        return message
            .replace(/\*/g, '\\*');
            // TODO
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
     * @method _slackLink
     * @private
     * @param {String} link Link to point to
     * @param {String} text Text to mask the link with
     * @return {String} Markdown-formatted masked link
     */
    _slackLink(link, text) {
        return `<${link}|${text}>`;
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
                return `(${this._slackLink(util.linkToDiff(general.server, general.scriptpath, args[0]), this.strings.diff)})`;
            case 'diffSize':
                const bold = (args[0] > 1000 || args[0] < -1000) ? '*' : '_';
                if(args[0] > 0) {
                    args[0] = `+${args[0]}`;
                }
                return `${bold}(${args[0]})${bold}`;
            case 'user':
                return `${this._slackLink(this._link(`User:${args[0]}`), args[0])} (${this._slackLink(this._link(`User talk:${args[0]}`), this.strings.talk)}|${this._slackLink(this._link(`Special:Contributions/${args[0]}`), this.strings.contribs)})`;
            case 'link':
                return this._slackLink(this._link(args[0]), (args[1] || args[0]));
            case 'userlink':
                return this._slackLink(this._link(args[0]), args[0].split(':')[1]);
            case 'summary':
                const a = args[0].trim().replace(/\n/g, '');
                return (a.length === 0) ? '' : `(_${this._escapeMrkdwn(a)}_)`;
            case 'debug':
                return `\`\`\`${args[0]}\`\`\``;
            case 'wiki':
                return `http://${args[0]}`;
            case 'board':
                return this._slackLink(this._link(`${this.info.namespaces[args[0] - 1]['*']}:${args[1]}`), this._formatMessage([`board-${args[0]}`, args[1]]));
        }
    }
}

module.exports = Slack;
