/**
 * main.js
 * Module containing the main program class
 */
'use strict';

/**
 * Importing modules
 */
const Wiki = require('./includes/wiki.js'),
      io = require('./includes/io.js');

/**
 * Main class
 * @class Logger
 */
class Logger {
    /**
     * Initializer
     * @method initialize
     */
    initialize() {
        this._initConfig();
        io.makeJar();
    	if(this._config.account && this._config.account.username) {
    		this._initAccount();
    	} else {
    		this._initWikis();
    	}
    }
    /**
     * Initializes the program configuration
     * @method _initConfig
     * @private
     */
    _initConfig() {
        try {
    		this._config = require(`./config.json`);
    	} catch(e) {
    		main.hook('error', 'An error occurred while loading the configuration! Please make sure config.json file in the main directory exists.', 'Logger', '_initConfig');
    	}
    }
    /**
     * Initializes information about wikis
     * @method _initWikis
     * @private
     */
    _initWikis() {
        this._wikis = [];
        let wikis = this._config.wikis;
    	if(typeof wikis !== 'object') {
    		console.warn('No wikis configured! Exiting program...');
    		return;
    	}
    	for(let i in wikis) {
    		if(wikis.hasOwnProperty(i)) {
    			this._wikis.push(new Wiki(i, wikis[i], (this._config.language || 'en'), this._cookieJar));
    		}
    	}
    }
    /**
     * Adds a wiki to array of wikis
     * @method addWiki
     * @param {Wiki} wiki Wiki object to add
     */
    addWiki(wiki) {
        this._wikis.push(wiki);
    }
    /**
     * Removes a wiki from the array of wikis
     * @method removeWiki
     * @param {Wiki} wiki The wiki to remove
     */
    removeWiki(wiki) {
        this._wikis.splice(this._wikis.indexOf(wiki), 1);
    }
    /**
     * Initializes the account used to access the API
     * @method _initAccount
     * @private
     */
    _initAccount() {
        let acc = this._config.account;
    	if(acc.password) {
    		this._login(acc);
    	} else {
            main.hook('enterPassword', acc.username, function(password) {
    			this._login({
    				username: acc.username,
    				password: password,
    				domain: acc.domain
    			});
    		});
    	}
    }
    /**
     * Logs in through the API
     * @method _login
     * @private
     */
    _login(info) {
    	let options = {
    		lgname: info.username,
    		lgpassword: info.password
    	};
    	if(info.token) {
    		options.lgtoken = info.token;
    	}
    	info.domain = info.domain || 'community';
    	io.api(info.domain, 'login', options, undefined, 'POST').then((function(data) {
    		switch(data.login.result) {
    			case 'NeedToken':
    				info.token = data.login.token;
    				this._login(info);
    				break;
    			case 'WrongToken':
                    main.hook('error', 'The supplied token was not a valid token!', 'Logger', '_login');
                    break;
    			case 'Illegal':
                    main.hook('error', 'Supplied user name is invalid!', 'Logger', '_login');
                    break;
    			case 'NotExists':
                    main.hook('error', 'Supplied user name does not exist!', 'Logger', '_login');
                    break;
    			case 'EmptyPass':
                    main.hook('error', 'Supplied password is empty!', 'Logger', '_login');
                    break;
    			case 'WrongPass':
    			case 'WrongPluginPass':
    				main.hook('error', 'Supplied password is incorrect!', 'Logger', '_login');
                    break;
    			case 'CreateBlocked':
                    main.hook('error', 'Auto-creation of the account is required but not possible!', 'Logger', '_login');
                    break;
    			case 'Throttled':
                    main.hook('error', 'Login attempts from your IP have been throttled!', 'Logger', '_login');
                    break;
    			case 'Blocked':
                    main.hook('error', `The user account you attempted to log into is blocked on ${info.domain}.wikia.com! You can change the login domain with the 'domain' parameter.`, 'Logger', '_login');
                    break;
    			case 'Aborted':
                    main.hook('error', `Logging in was aborted by an extension hook! Reason: ${data.login.reason ? data.login.reason : 'unknown'}`);
                    break;
                case 'Success':
    				main.hook('login');
                    this._account = info.username;
                    this._cookieJar = io.jar;
    				this._initWikis();
    		}
    	}).bind(this)).catch((error) => { console.log(error.stack); });
    }
    /**
     * Destroys all wikis
     * @method destroy
     * @todo Make this description and method name less scary
     */
    destroy() {
        this._wikis.forEach(el => el.destroy());
    }
    /**
     * Get all avaialable wikis
     * @return {Array<Wiki>} All available wikis
     */
    get wikis() {
        return this._wikis;
    }
    /**
     * Get project configuration
     * @return {Object} Project configuration
     */
    get config() {
        return this._config;
    }
    /**
     * Get logged in account name
     * @return {String} Account name
     */
    get account() {
        return this._account;
    }
}

module.exports = Logger;
