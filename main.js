/**
 * main.js
 * Module containing the main program class
 */
'use strict';

/**
 * Importing modules
 */
const Wiki = require('./includes/wiki.js'),
      io = require('./includes/io.js'),
      fs = require('fs'),
      util = require('./includes/util.js');

/**
 * URL from which to fetch the master branch package.json
 * for checking the version in update process
 */
const UPDATE_URL = 'https://raw.githubusercontent.com/KockaAdmiralac/WikiaActivityLogger/master/package.json';

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
        this._initCache();
        io.makeJar();
        this._checkForUpdates();
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
     * Initializes the program cache
     * @method _initCache
     * @private
     */
    _initCache() {
        try {
            this._cache = require('./cache.json');
        } catch(e) {
            main.hook('error', 'An error occurred while initializing cache. If this is your first time starting WikiaActivityLogger, ignore this error.', 'Logger', '_initCache');
            this._cache = { wikis: {} };
        }
        this._cacheInterval = setInterval(this._saveCache.bind(this), 5000); // TODO: Make interval configurable?
    }
    /**
     * Saves cache to cache.json
     * @method _saveCache
     * @private
     */
    _saveCache() {
        try {
            if(!(this._wikis instanceof Array)) {
                return;
            }
            this._cache.wikis = {};
            this._wikis.forEach(el => this._cache.wikis[el.name] = el.cache);
            if(this._cache && this._cache.wikis) {
                fs.writeFileSync('./cache.json', JSON.stringify(this._cache));
            }
        } catch(e) {
            main.hook('throw', e);
        }
    }
    /**
     * Checks for updates to WikiaActivityLogger
     * @method _checkForUpdates
     * @private
     */
    _checkForUpdates() {
        if(this._config.no_updates) {
            this._initAccount();
        } else {
            io.get(UPDATE_URL)
                .then((function(d) {
                    if(d.version !== process.env.npm_package_version) {
                        main.hook('updateAvailable', d.version);
                    }
                    this._initAccount();
                }).bind(this))
                .catch(error => main.hook('throw', error));
        }
    }
    /**
     * Initializes information about wikis
     * @method _initWikis
     * @private
     */
    _initWikis() {
        this._wikis = [];
        const wikis = this._config.wikis;
    	if(typeof wikis !== 'object') {
    		main.hook('noWikis');
    	}
        util.each(wikis, (k, v) => this._wikis.push(new Wiki(k, v, (this._config.language || 'en'), this._cookieJar, this._cache.wikis[k])), this);
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
        if(this._config.account && this._config.account.username) {
            const acc = this._config.account;
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
        } else {
            this._initWikis();
        }
    }
    /**
     * Logs in through the API
     * @method _login
     * @private
     */
    _login(info) {
    	const options = {
    		lgname: info.username,
    		lgpassword: info.password
    	};
    	if(info.token) {
    		options.lgtoken = info.token;
    	}
    	info.domain = info.domain || 'community';
    	io.api(info.domain, 'login', options, undefined, 'POST').then((function(data) {
    		switch(data.result) {
    			case 'NeedToken':
    				info.token = data.token;
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
                    main.hook('error', `Logging in was aborted by an extension hook! Reason: ${data.reason ? data.reason : 'unknown'}`);
                    break;
                case 'Success':
    				main.hook('login');
                    this._account = info.username;
                    this._cookieJar = io.jar;
    				this._initWikis();
    		}
    	}).bind(this)).catch(error => main.hook('throw', error));
    }
    /**
     * Destroys all wikis
     * Not really
     * @method destroy
     * @todo Make this method name less scary
     */
    destroy() {
        this._wikis.forEach(el => el.destroy());
        clearInterval(this._cacheInterval);
        this._saveCache();
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
