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
	Transport = require('../transport.js');

/**
 * Transport class
 * @class Notifications
 * @augments Transport
 */
class Notifications extends Transport {
	/**
	 * Bot calls this method when it wants to send a message
	 * through a transport.
	 * @method send
	 * @param {String} message Message to send
	 */
	send(message) {
		notifier.notify({
			'title': 'WikiaActivityLogger',
			'message': message,
		});
	}

}

module.exports = Notifications;
