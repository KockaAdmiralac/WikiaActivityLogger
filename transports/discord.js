'use strict';
const io = require('../io.js');

var Discord = function(config, wikiname) {
    if(!(this instanceof Discord)) {
		throw new Error('This isn\'t a static class! (Discord.constructor)');
	}
    if(config.type !== 'webhook') {
        throw new Error('Discord transport does not currently support any method other than webhook (Discord.constructor)');
    }
    if(typeof config.id === 'string' && typeof config.token === 'string') {
        this.url = `https://discordapp.com/api/webhooks/${config.id}/${config.token}`;
    }
    this.wikiname = wikiname;
};

Discord.prototype.escapeMessage = function(message) {
    // Escape URLs
    message = message.replace(/(http:\/\/[^ ]+)/g, '<$1>');
    return message;
};

Discord.prototype.send = function(message) {
    io.post(this.url, {
        content: this.escapeMessage(message)
    });
};

module.exports = Discord; // jshint ignore: line
