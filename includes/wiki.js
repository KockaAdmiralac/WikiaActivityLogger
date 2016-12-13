'use strict';

/**
 * Importing modules
 */
const io = require('./io.js'),
      util = require('./util.js');

/**
 * Constants
 */
const MIN_WKFROM = 1490000,
      MAX_WKTO = 999999999999999;

/**
 * Wiki object
 * @class Wiki
 */
class Wiki {
    /**
     * Class constructor
     * @constructor
     * @param {String} name Wiki subdomain
     * @param {Object} config Wiki configuration
     * @param {String} lang Language used while logging
     * @param {Object} jar Cookie jar
     */
    constructor(name, config, lang, jar, cache) {
        if(typeof name !== 'string' || typeof config !== 'object') {
            this._error('`name` or `config` parameter invalid');
        }
        this.name = name;
        this._hook('initStart');
        this.config = config;
        this._cache = cache || {
            threads: {}
        };
        this.language = this.config.language || lang;
        io.jar = jar;
        this._initStrings();
        this._initTransport();
        let fetchSources = this.config.fetch || ['rc', 'log'];
        this.fetch = fetchSources.map(this._dispatchFetcher.bind(this));
        this._initInterval();
    }
    /**
     * Initializes string data
     * @method _initStrings
     * @private
     */
    _initStrings() {
        try {
            this.strings = require(`../i18n/${this.language}.json`);
        } catch(e) {
            this._error(`Language '${this.language}' not found! Resorting to 'en'...`);
            this.strings = require(`../i18n/en.json`);
        }
    }
    /**
     * Initializes transports
     * @method _initStrings
     * @private
     */
    _initTransport() {
        let t = this.config.transport;
        if(typeof t === 'object' && typeof t.platform === 'string') {
            let Transport = require(`../transports/${t.platform}/index.js`);
            this.transport = new Transport(t, this.name, this.strings);
        } else {
            this._error('Transport configuration invalid!');
        }
    }
    /**
     * Calls a controller hook
     * @method _hook
     * @private
     */
    _hook() {
        main.hook.apply(main, Array.prototype.concat('wiki', this, Array.prototype.slice.call(arguments)));
    }
    /**
     * Sends an error command to controller
     * @method _error
     * @private
     * @param {String} message Message to log
     */
    _error(error) {
        if(typeof error === 'string') {
            this._hook('error', error);
        } else if(error instanceof Error) {
            this._hook('error', error.stack);
        }
    }
    /**
     * Shorthand for io.api
     * @method _api
     * @private
     * @param {String} action Action to use
     * @param {Object} data Other data to supply
     * @param {Function} transform How to transform the data when receieved
     * @return {Promise} Promise to listen for response on
     */
    _api(action, data, transform) {
        return io.api(this.name, action, data, transform);
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
            // Some stuff happened so we shouldn't care
            return;
        }
        let msg = this.strings[args.splice(0, 1)[0]];
        if(typeof msg !== 'string') {
            this._error('Given message isn\'t a string');
        }
        return util.format(msg, args.map(this.transport.preprocess));
    }
    /**
     * Links to a thread
     * @method _thread
     * @private
     * @param {String} page Thread page to link to
     * @return {String} Link to the thread
     * @todo Make cache great again
     */
    _thread(page) {
        if(typeof this._cache.threads === 'object') {
            let split = page.split('/'),
                threadPage = `${split[0]}/${split[1]}`;
            if(typeof this._cache.threads[threadPage] === 'object') {
                let thread = this._cache.threads[threadPage];
                // TODO: Temporary bugfix, I've no idea why is this happening
                thread.replace(/Thread:/g, '');
                thread[0] = `Thread:${thread[0]}`;
                return thread;
            } else {
                this._cacheThread(threadPage);
            }
        } else {
            this._cache.threads = {};
        }
        return [page, this.strings.message];
    }
    /**
     * Caches a thread page
     * @method _cacheThread
     * @private
     * @param {String} page Page to cache
     */
    _cacheThread(page) {
        this._api('query', {
            prop: 'revisions',
            titles: page,
            rvlimit: 1,
            rvprop: 'content'
        }).then((function(d) {
            for(let i in d.query.pages) {
                if(d.query.pages.hasOwnProperty(i)) {
                    this._cache.threads[page] = [i, /<ac_metadata\s*title="([^"]+)\s*[^>]*>\s*<\/ac_metadata>/g.exec(d.query.pages[i].revisions[0]['*'])[1]];
                }
            }
        }).bind(this)).catch(error => this._error(error));
    }
    /**
     * Names a board
     * @method _board
     * @private
     * @param {String} page Board name
     * @param {Number} ns Board namespace
     * @return {String} Named board
     */
    _board(page, ns) {
        let split = page.split(':')[1].split('/')[0];
        return [`${(ns === 1201) ? 'Message Wall' : 'Board'}:${split}`, this._formatMessage([`board-${ns}`, split])];
    }
    /**
     * Initializes the new wiki listener
     * @method _initNewwikis
     * @private
     */
    _initNewwikis(wkfrom) {
        wkfrom = wkfrom || this._cache.wkfrom || MIN_WKFROM;
        this._api('query', {
            list: 'wkdomains',
            wkcountonly: 1,
            wkfrom: wkfrom,
            wkto: MAX_WKTO
        }).then((function(d) {
            if(d.query.wkdomains.count > 0) {
                this._initNewwikis(wkfrom + Number(d.query.wkdomains.count));
            } else {
                this._cache.wkfrom = wkfrom;
                this._newwikisInitialized = true;
            }
        }).bind(this)).catch(error => this._error(error));
    }
    /**
     * Initializes the interval
     * This is the last initializer to fire
     * @method _initInterval
     * @private
     */
    _initInterval() {
        this._tempFetchedInitial = 0;
        this.fetch.forEach(function(el) {
            el.call(this)
                .then((function() {
                    if(++this._tempFetchedInitial === this.fetch.length) {
                        this._hook('initInterval');
                        if(this.config.welcome) {
                            this.transport.send(this._formatMessage(['start', process.env.npm_package_name, process.env.npm_package_version]));
                        }
                        this.interval = setInterval(this._update.bind(this), (this.config.interval || 500));
                    }
                }).bind(this))
                .catch(error => this._error(error));
        }, this);
    }
    /**
     * Fetches RecentChanges information
     * @method _fetchRC
     * @private
     * @return {Promise} Promise to listen for response on
     */
    _fetchRC() {
        let options = {
            list: 'recentchanges',
            rcprop: 'user|title|ids|timestamp|comment|flags|tags|loginfo|sizes',
            rcshow: '!bot',
            rclimit: 500
        };
        if(typeof this.rcend === 'string') {
            options.rcend = this.rcend;
        }
        if(typeof this.config.excludeuser === 'string') {
            options.rcexcludeuser = this.config.excludeuser;
        }
        return this._api('query', options, (function(data) {
            if(typeof data.query && data.query.recentchanges instanceof Array) {
                let rc = data.query.recentchanges,
                    rcdate = new Date(this.rcend);
                if(typeof this.rcend === 'string') {
                    rc = rc.filter((el) => new Date(el.timestamp) > rcdate);
                }
                this.rcend = data.query.recentchanges[0].timestamp;
                return rc;
            } else {
                this._error('Recent changes data not valid');
            }
        }).bind(this));
    }
    /**
     * Fetches Log information
     * @method _fetchLog
     * @private
     * @return {Promise} Promise to listen for response on
     */
    _fetchLog() {
        let options = {
            list: 'logevents',
            leprop: 'ids|title|type|user|timestamp|comment|details|tags',
            lelimit: 500
        };
        if(typeof this.leend === 'string') {
            options.leend = this.leend;
        }
        if(this.config.logs instanceof Array) {
            options.letype = this.config.logs.join('|');
        }
        return this._api('query', options, (function(data) {
            if(data.query && data.query.logevents instanceof Array) {
                var log = data.query.logevents,
                    logdate = new Date(this.leend);
                if(typeof this.leend === 'string') {
                    log = log.filter((el) => new Date(el.timestamp) > logdate);
                }
                this.leend = data.query.logevents[0].timestamp;
                return log;
            } else {
                this._error('Log data not valid');
            }
        }).bind(this));
    }
    /**
     * Fetches abuse Log information
     * @method _fetchLog
     * @private
     * @return {Promise} Promise to listen for response on
     */
    _fetchAbuseLog() {
        let options = {
            list: 'abuselog',
            aflprop: 'filter|user|title|action|result|timestamp|ids',
            afllimit: 500
        };
        if(typeof this.aflend === 'string') {
            options.aflend = this.aflend;
        }
        return this._api('query', options, (function(data) {
            if(data.query && data.query.abuselog instanceof Array) {
                var log = data.query.abuselog,
                    logdate = new Date(this.aflend);
                if(typeof this.aflend === 'string') {
                    log = log.filter((el) => new Date(el.timestamp) > logdate);
                }
                this.aflend = data.query.abuselog[0].timestamp;
                return log;
            } else {
                this._error('Abuse log data not valid');
            }
        }).bind(this));
    }
    /**
     * Fetches new wiki information
     * @method _fetchNewwikis
     * @private
     * @return {Promise} Promise to listen for response on
     */
    _fetchNewwikis() {
        return this._api('query', {
            list: 'wkdomains',
            wkfrom: this._cache.wkfrom || MAX_WKTO,
            wkto: MAX_WKTO
        }, (function(data) {
            if(!this._newwikisInitialized) {
                // TODO: This isn't optimal for bandwidth
                return [];
            }
            let obj = data.query.wkdomains, arr = [];
            for(var i in obj) {
                if(obj.hasOwnProperty(i)) {
                    ++this._cache.wkfrom;
                    arr.push(obj[i]);
                }
            }
            return arr.filter((el) => !(/qatestwiki/.test(el.domain)));
        }).bind(this));
    }
    /**
     * Returns the fetcher method based on the configuration option
     * @method _dispatchFetcher
     * @private
     * @param {String} type Configuration option
     * @return {Function} Function to call when fetching
     */
    _dispatchFetcher(type) {
        switch(type) {
            case 'rc':
            case 'recent changes':
                return this._fetchRC;
            case 'log':
                return this._fetchLog;
            case 'abuselog':
            case 'al':
            case 'abuse log':
                return this._fetchAbuseLog;
            case 'newwikis':
                this._initNewwikis();
                return this._fetchNewwikis;
        }
    }
    /**
     * Fetches the information
     * @method _update
     * @private
     */
    _update() {
        this.fetch.forEach(function(el) {
            el.call(this)
                .then(function(data) {
                    if(data.length > 0) {
                        data.forEach(function(entry) {
                            let result = this._formatMessage(this._handle(entry));
                            if(typeof result === 'string') {
                                this.transport.send(result);
                            }
                        }, this);
                    }
                }.bind(this))
                .catch(error => this._error(error));
        }, this);
    }
    /**
     * Handles RC, log, abuse log etc. entry data
     * @method _handle
     * @private
     * @param {Object} info Information about the entry
     * @return {Array<String>} Array of information to be passed to _formatMessage
     */
    _handle(info) {
        switch(info.type) {
            case undefined:
                if(typeof info.filter_id === 'number') {
                    // This is an abuse log
                    return ['abuselog', info.user, info.filter_id, info.filter, info.action, info.title, this.strings[`action-${info.result}`]];
                } else if(typeof info.domain === 'string') {
                    return ['newwikis', info.domain];
                }
                break;
            case 'new':
                // Not a log
                return (info.ns === 1201 || info.ns === 2001) ?
                    ['newthread', info.user].concat(this._thread(info.title), this._board(info.title, info.ns), (info.newlen - info.oldlen), info.comment) :
                    ['new', info.user, info.title, (info.newlen - info.oldlen), info.comment];
            case 'edit':
                // Not a log
                return (info.ns === 1201 || info.ns === 2001) ?
                    ['editthread', info.user].concat(this._board(info.title, info.ns), (info.newlen - info.oldlen), info.revid, info.comment) :
                    ['edit', info.user, info.title, (info.newlen - info.oldlen), info.revid, info.comment];
            case 'log':
                if(info.logtype !== '0') {
                    return;
                }
                switch(info.logaction) {
                    // Why Wikia, why
                    case 'wall_archive': return ['threadclose', info.user].concat(this._thread(info.title), this._board(info.title, info.ns), info.comment);
                    case 'wall_remove': return ['threadremove', info.user].concat(this._thread(info.title), this._board(info.title, info.ns), info.comment);
                    case 'wall_admindelete': return ['threaddelete', info.user].concat(this._thread(info.title), this._board(info.title, info.ns), info.comment);
                    case 'wall_restore': return ['threadrestore', info.user].concat(this._thread(info.title), this._board(info.title, info.ns), info.comment);
                }
                break;
            case 'block':
                switch(info.action) {
                    case 'block':
                    case 'reblock': return [info.action, info.user, info.title, info.block.duration, info.block.flags, info.comment];
                    case 'unblock': return ['unblock', info.user, info.title, info.comment];
                }
                break;
            case 'newusers': return ['newusers', info.user];
            case 'useravatar':
                switch(info.action) {
                    case 'avatar_chn': return ['avatar', info.user];
                    case 'avatar_rem': return ['remavatar', info.user, info.title];
                }
                break;
            case 'delete':
                switch(info.action) {
                    case 'delete': return ['delete', info.user, info.title, info.comment];
                    case 'revisions': return ['debug', JSON.stringify(info)]; // TODO
                    case 'event': return ['debug', JSON.stringify(info)]; // TODO
                    case 'restore': return ['restore', info.user, info.title, info.comment];
                }
                break;
            case 'patrol':
            case 'templateclassification':
                break; // Not going to handle this, they are simply useless
            case 'move':
                switch(info.action) {
                    case 'move': return ['move', info.user, info.title, info.move.new_title, info.comment];
                    case 'move_redir': return ['moveredir', info.user, info.title, info.move.new_title, info.comment];
                }
                break;
            case 'rights':
                switch(info.action) {
                    case 'rights': return ['rights', info.user, info.title, info.rights.old, info.rights.new, info.comment];
                    case 'autopromote': return ['debug', JSON.stringify(info)]; // TODO
                }
                break;
            case 'upload':
                switch(info.action) {
                    case 'upload': return ['upload', info.user, info.title, info.comment];
                    case 'overwrite': return ['reupload', info.user, info.title, info.comment];
                    case 'revert': return ['debug', JSON.stringify(info)]; // TODO
                }
                break;
            case 'chatban':
                switch(info.action) {
                    case 'chatbanadd':
                    case 'chatbanchange': return [info.action, info.user, info.title, info[2], info.comment];
                    case 'chatbanremove': return ['chatbanremove', info.user, info.title, info.comment];
                }
                break;
            case 'protect':
                // Ignore action == move_prot
                switch(info.action) {
                    case 'protect': return ['protect', info.user, info.title, info[0], info.comment];
                    case 'modify': return ['reprotect', info.user, info.title, info[0], info.comment]; // TODO
                    case 'unprotect': return ['unprotect', info.user, info.title, info.comment];
                }
                break;
            case 'merge': return ['merge', info.title, info[0], this.comment];
            case 'abusefilter': return ['abusefilter', info.user, info[1], info[0]];
            case 'wikifeatures': return ['wikifeatures', info.user, info.comment];
            case 'import':
                switch(info.action) {
                    case 'interwiki': return ['debug', JSON.stringify(info)]; // TODO
                    case 'upload': return ['import', info.user, info.title, info.comment];
                }
                break;
            case 'maps':
                switch(info.action) {
                    case 'create_pin': return ['createpin', info.user, info.title, info.summary];
                    case 'delete_pin': return ['deletepin', info.user, info.title];
                    case 'update_pin': return ['updatepin', info.user, info.title, info.summary];
                    case 'create_map': return ['createmap', info.user, info.title, info.summary];
                    case 'delete_map': return ['deletemap', info.user];
                }
                break;
            case 'renameuser': return ['renameuser', info.user, info.comment];
            // Cases to handle:
            // suppress - Suppresses something? Idk
            // editaccnt - This is used when accounts get disabled iirc
            // phalanx - BOOM
            // phalanxemail - b@o.om
            // chatconnect - Checkuser for chat
            // piggyback - 🐷
            // TODO make sactage run this program through his server so we see all the phalanxes c:
            // Jk
            default: return ['debug', JSON.stringify(info)];
        }
    }
    /**
     * Destroys the wiki! Not really, it unsets the
     * interval so the object can be properly disposed
     * @method destroy
     */
    destroy() {
        clearInterval(this.interval);
    }
    /**
     * Get cache
     * @return {Object} Cache
     */
    get cache() {
        return this._cache;
    }
}

module.exports = Wiki;
