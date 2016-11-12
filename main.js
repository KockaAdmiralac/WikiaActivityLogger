/**
 * main.js
 * Entry point for the program
 */
'use strict';

/**
 * Importing the Wiki object
 */
const Wiki = require('./includes/wiki.js'),
      io = require('./includes/io.js'),
      util = require('./includes/util.js');

/**
 * Main class
 * @class Logger
 */
class Logger {
    /**
     * Class constructor
     * @constructor
     * @throws {Error} When called
     */
    constructor() {
        throw new Error('This is a static class! (Logger.constructor)');
    }
    /**
     * Entry point of the program
     * @method init
     * @static
     */
    static init() {
        Logger._initConfig();
        io.makeJar();
        Logger._read = require('readline').createInterface({
        	input: process.stdin,
        	output: process.stdout
        });
    	if(Logger._config.account && Logger._config.account.username) {
    		Logger._initAccount();
    	} else {
    		Logger._initWikis();
    	}
    }
    /**
     * Initializes the program configuration
     * @method _initConfig
     * @static
     * @private
     */
    static _initConfig() {
        try {
    		Logger._config = require(`./config.json`);
    	} catch(e) {
    		console.warn('An error occurred while loading the configuration! Please make sure config.json file in the main directory exists.');
    		return;
    	}
    }
    /**
     * Initializes information about wikis
     * @method _initWikis
     * @static
     * @private
     */
    static _initWikis() {
        Logger._wikis = [];
        let wikis = Logger._config.wikis;
    	if(typeof wikis !== 'object') {
    		console.warn('No wikis configured! Exiting program...');
    		return;
    	}
    	for(let i in wikis) {
    		if(wikis.hasOwnProperty(i)) {
    			Logger._wikis.push(new Wiki(i, wikis[i], (Logger._config.language || 'en'), Logger._cookieJar));
    		}
    	}
    }
    /**
     * Initializes the account used to access the API
     * @method _initAccount
     * @static
     * @private
     */
    static _initAccount() {
        let acc = Logger._config.account;
    	if(acc.password) {
    		Logger._login(acc);
    	} else {
    		Logger._read.question(`Please supply a password for ${acc.username}: `, function(password) {
    			if(password) {
    				Logger._login({
    					username: acc.username,
    					password: password,
    					domain: acc.domain
    				});
    			} else {
    				console.warn('Please supply a password!');
    			}
    		});
    	}
    }
    /**
     * Logs in through the API
     * @method _login
     * @static
     * @private
     */
    static _login(info) {
    	let options = {
    		lgname: info.username,
    		lgpassword: info.password
    	}, body;
    	if(info.token) {
    		options.lgtoken = info.token;
    	}
    	info.domain = info.domain || 'community';
    	io.api(info.domain, 'login', options, undefined, 'POST', body).then((data) => {
    		switch(data.login.result) {
    			case 'NeedToken':
    				info.token = data.login.token;
    				Logger._login(info);
    				break;
    			case 'WrongToken':
                    util.logError('The supplied token was not a valid token!', 'Logger', '_login');
                    break;
    			case 'Illegal':
                    util.logError('Supplied user name is invalid!', 'Logger', '_login');
                    break;
    			case 'NotExists':
                    util.logError('Supplied user name does not exist!', 'Logger', '_login');
                    break;
    			case 'EmptyPass':
                    util.logError('Supplied password is empty!', 'Logger', '_login');
                    break;
    			case 'WrongPass':
    			case 'WrongPluginPass':
    				util.logError('Supplied password is incorrect!', 'Logger', '_login');
                    break;
    			case 'CreateBlocked':
                    util.logError('Auto-creation of the account is required but not possible!', 'Logger', '_login');
                    break;
    			case 'Throttled':
                    util.logError('Login attempts from your IP have been throttled!', 'Logger', '_login');
                    break;
    			case 'Blocked':
                    util.logError(`The user account you attempted to log into is blocked on ${info.domain}.wikia.com! You can change the login domain with the 'domain' parameter.`, 'Logger', '_login');
                    break;
    			case 'Aborted':
                    util.logError(`Logging in was aborted by an extension hook! Reason: ${data.login.reason ? data.login.reason : 'unknown'}`);
                    break;
                case 'Success':
    				console.info('Login successful!');
                    Logger._cookieJar = io.jar;
    				Logger._initWikis();
    		}
    	}).catch((error) => { console.log(error.stack); });
    }
    /**
     * Getter for all avaialable wikis
     * @static
     * @return {Array<Wiki>} All available wikis
     */
    static get wikis() {
        return Logger._wikis;
    }
    /**
     * Getter for project configuration
     * @static
     * @return {Object} Project configuration
     */
    static get config() {
        return Logger._config;
    }
}

// Ready... set... GO!!!
Logger.init();
