'use strict';
const io = require('../includes/io.js'),
      util = require('../includes/util.js');

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
    constructor(name, config, lang, jar) {
        if(typeof name !== 'string' || typeof config !== 'object') {
            throw new Error('`name` or `config` parameter invalid (Wiki.constructor)');
        }
        this.name = name;
        this._log('Initiating...');
        this.config = config;
        this.language = this.config.language || lang;
        io.jar = jar;
        this._initStrings();
        this._initTransport();
        let fetchSources = this.config.fetch || ['rc', 'log'];
        this.fetch = fetchSources.map(this._dispatchFetcher.bind(this));
        this.threadCache = {};
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
            this._log(`Language '${this.language}' not found! Resorting to 'en'...`);
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
            let Transport = require(`../transports/${t.platform}.js`);
            this.transport = new Transport(t, this.name, this.strings);
        } else {
            util.logError('Transport configuration invalid!', 'Wiki', 'constructor');
        }
    }
    /**
     * Logs something to console with a wiki-specific tag
     * @method _log
     * @private
     * @param {String} message Message to log
     */
    _log(message) {
        console.log(`[${this.name}] ${message}`);
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
            util.logError('Given message isn\'t a string', 'Wiki', 'prototype.formatMessage');
        }
        return util.format(msg, args);
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
        let split = page.split('/'),
            threadPage = `${split[0]}/${split[1]}`;
        return (this.threadCache[threadPage] ? `Thread:${this.threadCache[threadPage]}` : page);
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
        return this._formatMessage([`board-${ns}`, page.split(':')[1].split('/')[0]]);
    }
    /**
     * Fetches threads and puts them in the cache
     * @method _fetchThreads
     * @private
     * @todo Make cache great again
     */
    _fetchThreads() {
        if(typeof this.config.threadfetch !== 'object') {
            this.config.threadfetch = {};
        }
        if(typeof this.config.threadfetch.method !== 'string') {
            this.config.threadfetch.method = 'api';
        }
        switch(this.config.threadfetch.method) {
            case 'api': return this._fetchThreadsAPI();
            case 'dpl': return this._fetchThreadsDPL();
        }
    }
    /**
     * Fetches threads through the API and puts them in the cache
     * @method _fetchThreadsAPI
     * @private
     * @param {String} apfrom Parameter `apfrom` to pass to API
     * @todo Make cache great again
     */
    _fetchThreadsAPI(apfrom, forum) {
        let options = {
            list: 'allpages',
            aplimit: 5000,
            apfilterredir: 'nonredirects',
            apnamespace: forum ? 2001 : 1201
        };
        if(typeof apfrom === 'string') {
            options.apfrom = apfrom;
        }
        this._api('query', options).then((function(data) {
            data.query.allpages.filter((el) => el.title.split('/').length > 2).forEach((el) => {
                this.threadCache[el.title] = el.pageid;
            }, this);
            if(data['query-continue'] && data['query-continue'].allpages && typeof data['query-continue'].allpages.apfrom === 'string') {
                this._fetchThreadsAPI(data['query-continue'].allpages.apfrom, forum);
            } else if(!forum) {
                // If already went through forum threads go to wall threads
                this._fetchThreadsAPI(undefined, true);
            }
        }).bind(this)).catch((error) => { throw error; });
    }
    /**
     * Generates a DPL to list threads
     * @method _generateDPL
     * @private
     * @param {Number} namespace Namespace to generate a DPL for
     * @param {Number} index Index from which to start listing
     * @return {String} Generated DPL
     */
    _generateDPL(namespace, index) {
        return `<dpl>
            namespace   = ${namespace}
            titleregexp = \\w+\\/@comment-[^\\/]+$
            showcurid   = true
            offset      = ${index * 500}
        </dpl>`;
    }
    /**
     * Fetch threads through DPLs and cache them
     * @method _fetchThreadsDPL
     * @private
     * @param {Number} index Index of the current fetch
     */
    _fetchThreadsDPL(index) {
        index = index || 0;
        let text = '',
            offset = this.config.threadfetch.offset || 1;
        for(var i = 0; i < offset; ++i) {
            text += this.generateDPL('Thread', index + i) + this.generateDPL('Board_Thread', index + i);
        }
        this._api('parse', { text: text  })
            .then(function(data) {
                if(data && data.parse && data.parse.text && typeof data.parse.text['*'] === 'string') {
                    let regex = /<a  class="text" href="http:\/\/\w+\.wikia\.com\/wiki\/[^?]+\?curid=(\d+)">([^<]+)<\/a>/g,
                        matches = data.parse.text['*'].match(regex);
                    if(matches && matches.length > 0) {
                        matches.forEach((el) => {
                            let result = regex.exec(el);
                            this.threadCache[result[2]] = result[1];
                            regex.exec('javascript sucks'); // it really does
                        }, this);
                        this.log(`fetched ${matches.length}`);
                        this.fetchThreadsDPL(index + offset);
                    }
                }
            }.bind(this))
            .catch((error) => { throw error; });
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
                        this._log('Initiated, interval set!');
                        this.interval = setInterval(this._update.bind(this), (this.config.interval || 500));
                    }
                }).bind(this))
                .catch(function(error) { throw error; });
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
                throw new Error(`Recent changes data not valid for w:c:${this.name} (Wiki.prototype._fetchRC)`);
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
                throw new Error(`Log data not valid for w:c:${this.name} (Wiki.prototype.fetchLog)`);
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
                throw new Error(`Abuse log data not valid for w:c:${this.name} (Wiki.prototype.fetchAbuseLog)`);
            }
        }).bind(this));
    }
    /**
     * Returnes the fetcher method based on the configuration option
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
                .catch((error) => { throw error; });
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
                }
                break;
            case 'new':
                // Not a log
                return (info.ns === 1201 || info.ns === 2001) ?
                    ['newthread', info.user, this._thread(info.title), this._board(info.title, info.ns), (info.newlen - info.oldlen), info.comment] :
                    ['new', info.user, info.title, (info.newlen - info.oldlen), info.comment];
            case 'edit':
                // Not a log
                return (info.ns === 1201 || info.ns === 2001) ?
                    ['editthread', info.user, this._board(info.title, info.ns), (info.newlen - info.oldlen), info.revid, info.comment] :
                    ['edit', info.user, info.title, (info.newlen - info.oldlen), info.revid, info.comment];
            case 'log':
                if(info.logtype !== '0') {
                    return;
                }
                switch(info.logaction) {
                    // Why Wikia, why
                    case 'wall_archive': return ['threadremove', info.user, this._thread(info.title), this._board(info.title, info.ns), info.comment];
                    case 'wall_remove': return ['threadremove', info.user, this._thread(info.title), this._board(info.title, info.ns), info.comment];
                    case 'wall_admindelete': return ['threaddelete', info.user, this._thread(info.title), this._board(info.title, info.ns), info.comment];
                    case 'wall_restore': return ['threadrestore', info.user, this._thread(info.title), this._board(info.title, info.ns), info.comment];
                }
                break;
            case 'block':
                switch(info.action) {
                    case 'block':
                    case 'reblock': return [info.action, info.user, info.title, info.block.duration, info.block.flags, info.comment];
                    case 'unblock': return ['unblock', info.user];
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
            case 'abusefilter': return ['abusefilter', info.user, info[1], `Special:AbuseFilter/history/${info[1]}/diff/prev/${info[0]}`];
            case 'wikifeatures': return ['wikifeatures', info.user, info.comment];
            case 'import':
                switch(info.action) {
                    case 'interwiki': return ['debug', JSON.stringify(info)]; // TODO
                    case 'upload': return ['import', info.user, info.title, info.comment];
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
}

module.exports = Wiki;
