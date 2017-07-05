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
        this._name = name;
        this._hook('initStart');
        this._initConfig(config, lang);
        this._cache = cache || {
            threads: {}
        };
        io.jar = jar;
        this._initStrings();
        this.sources = (this.config.fetch || ['rc', 'log']).map(this._dispatchFetcher.bind(this));
        this._fetchInfo();
    }
    /**
     * Initializes wiki configuration
     * @method _initConfig
     * @private
     * @param {Object} config Configuration object
     * @param {String} lang Wiki language
     */
    _initConfig(config, lang) {
        this.config = config;
        this.bots = this.config.bots || ['Wikia', 'WikiaBot', 'Fandom', 'FandomBot'];
        this.excludefilter = this.config.excludefilter || [];
        this.language = this.config.language || lang;
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
        const t = this.config.transport;
        if(typeof t === 'object' && typeof t.platform === 'string') {
            const Transport = require(`../transports/${t.platform}/index.js`);
            this.transport = new Transport(t, this._info, this.strings);
        } else {
            this._error('Transport configuration invalid!');
        }
    }
    /**
     * Initializes fetch sources
     * @method _initSources
     * @private
     */
    _initSources() {
        if(util.includes(this.sources, 'abuselog') && this._info.userinfo.rights.indexOf('abusefilter-log') === -1) {
            // The user does not have permissions to view
            // the abuse log (isn't logged in) or the wiki
            // doesn't have AbuseFilter enabled
            this._error('Failed to initialize abuse log listener!');
            util.remove(this.sources, 'abuselog');
        }
        this._processQS = this.sources.map(f => this[`_${f}QS`]);
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
        return io.api(this._name, action, data, transform);
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
            const split = page.split('/'),
                  threadPage = `${split[0]}/${split[1]}`;
            if(typeof this._cache.threads[threadPage] === 'object') {
                const thread = this._cache.threads[threadPage];
                // TODO: Temporary bugfix, I've no idea why is this happening
                thread[0] = `Thread:${thread[0].replace(/Thread:/g, '')}`;
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
     * Decodes HTML entities
     * @param {String} text text to decode
     * @return {String} decoded text
     */
    _decodeHTMLEntities(text) {
        const entities = [
            ['amp', '&'],
            ['apos', '\''],
            ['#39', '\''],
            ['#x27', '\''],
            ['#x2F', '/'],
            ['#39', '\''],
            ['#47', '/'],
            ['lt', '<'],
            ['gt', '>'],
            ['nbsp', ' '],
            ['quot', '"']
        ];

        for (var i = 0, max = entities.length; i < max; ++i) 
            text = text.replace(new RegExp(`&entities[i][0];`, 'g'), entities[i][1]);

        return text;
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
            util.each(d.pages, function(k, v) {
                const revs = v.revisions;
                if(revs instanceof Array && revs.length > 0) {
                    this._cache.threads[page] = [k, this._decodeHTMLEntities(/<ac_metadata\s*title="([^"]+)\s*[^>]*>\s*<\/ac_metadata>/g.exec(revs[0]['*'])[1])];
                }
            }, this);
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
        return [ns, page.split(':')[1].split('/')[0]];
    }
    /**
     * Fetches information about the wiki from the API
     * @method _fetchInfo
     * @private
     */
    _fetchInfo() {
        const siprop = ['general', 'statistics', 'rightsinfo', 'skins', 'category', 'wikidesc', 'namespaces', 'languages'],
              uiprop = ['blockinfo', 'rights', 'groups', 'changeablegroups', 'options', 'preferencestoken', 'editcount', 'ratelimits', 'registrationdate'];
        this._api('query', {
            meta: 'siteinfo|userinfo',
            siprop: siprop.join('|'),
            uiprop: uiprop.join('|'),
            list: this.sources.join('|')
        }).then((function(d) {
            this._info = {};
            siprop.forEach((el => this._info[el] = d[el]), this);
            this._info.userinfo = d.userinfo;
            if(d.recentchanges instanceof Array && d.recentchanges.length > 0) {
                this._rcend = d.recentchanges[0].timestamp;
            }
            if(d.logevents instanceof Array && d.logevents.length > 0) {
                this._leend = d.logevents[0].timestamp;
            }
            if(d.abuselog instanceof Array && d.abuselog.length > 0) {
                this._aflend = d.abuselog[0].timestamp;
            }
            this._initTransport();
            this._initSources();
            this._initInterval();
        }).bind(this)).catch(error => this._error(error));
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
            if(d.wkdomains.count > 0) {
                this._initNewwikis(wkfrom + Number(d.wkdomains.count));
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
        this._hook('initInterval');
        if(this.config.welcome) {
            this.transport.send(['start', process.env.npm_package_name, process.env.npm_package_version]);
        }
        this.interval = setInterval(this._update.bind(this), (this.config.interval || 500));
    }
    /**
     * Processes the query string for recent changes fetcher
     * @method _recentchangesQS
     * @private
     * @return {Object} Object with query string parameters
     */
    _recentchangesQS() {
        const options = {
            rcprop: 'user|title|ids|timestamp|comment|flags|tags|loginfo|sizes',
            rcshow: '!bot',
            rclimit: 500,
            rcend: this._rcend
        };
        if(typeof this.config.excludeuser === 'string') {
            options.rcexcludeuser = this.config.excludeuser;
        }
        return options;
    }
    /**
     * Processes the query string for log events fetcher
     * @method _logeventsQS
     * @private
     * @return {Object} Object with query string parameters
     */
    _logeventsQS() {
        const options = {
            leprop: 'ids|title|type|user|timestamp|comment|details|tags',
            lelimit: 500,
            leend: this._leend
        };
        if(this.config.logs instanceof Array) {
            options.letype = this.config.logs.join('|');
        }
        return options;
    }
    /**
     * Processes the query string for abuse log fetcher
     * @method _abuselogQS
     * @private
     * @return {Object} Object with query string parameters
     */
    _abuselogQS() {
        return {
            aflprop: 'filter|user|title|action|result|timestamp|ids',
            afllimit: 500,
            aflend: this._aflend
        };
    }
    /**
     * Processes the query string for new wikis fetcher
     * @method _wkdomainsQS
     * @private
     * @return {Object} Object with query string parameters
     */
    _wkdomainsQS() {
        return this._newwikisInitialized ? {
            wkfrom: this._cache.wkfrom || MAX_WKTO,
            wkto: MAX_WKTO
        } : {
            wkfrom: 0,
            wkto: 0
        };
    }
    /**
     * Processes data from recent changes
     * @method _fetchRC
     * @private
     * @param {Array} data Unprocessed data from API
     * @return {Array} Array of processed events
     */
    _recentchangesProcess(data) {
        data = data.filter((el => new Date(el.timestamp) > new Date(this._rcend) && !util.includes(this.bots, el.user)), this);
        if(data.length > 0) {
            this._rcend = data[0].timestamp;
        }
        return data;
    }
    /**
     * Processes data from log
     * @method _logeventsProcess
     * @private
     * @param {Array} data Unprocessed data from API
     * @return {Array} Array of processed events
     */
    _logeventsProcess(data) {
        data = data.filter((el => new Date(el.timestamp) > new Date(this._leend) && !util.includes(this.bots, el.user)), this);
        if(data.length > 0) {
            this._leend = data[0].timestamp;
        }
        return data;
    }
    /**
     * Processes data from abuse log
     * @method _abuselogProcess
     * @private
     * @param {Array} data Unprocessed data from API
     * @return {Array} Array of processed events
     */
    _abuselogProcess(data) {
        data = data.filter((el => new Date(el.timestamp) > new Date(this._aflend) && !util.includes(this.excludefilter, Number(el.filter_id))), this);
        data.forEach(el => el.type = 'abuse log');
        if(data.length > 0) {
            this._aflend = data[0].timestamp;
        }
        return data;
    }
    /**
     * Processes data from new wiki log
     * @method _wkdomainsProcess
     * @private
     * @param {Array} data Unprocessed data from API
     * @return {Array} Array of processed events
     */
    _wkdomainsProcess(data) {
        if(!this._newwikisInitialized) {
            return [];
        }
        const arr = [];
        util.each(data, function(k, v) {
            ++this._cache.wkfrom;
            v.type = 'new wiki';
            arr.push(v);
        }, this);
        return arr.filter((el) => !(/qatestwiki/.test(el.domain)));
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
            case 'recentchanges':
                return 'recentchanges';
            case 'log':
            case 'logevents':
                return 'logevents';
            case 'abuselog':
            case 'al':
            case 'abuse log':
                return 'abuselog';
            case 'newwikis':
            case 'wkdomains':
                this._initNewwikis();
                return 'wkdomains';
        }
    }
    /**
     * Fetches the information
     * @method _update
     * @private
     */
    _update() {
        const qs = { list: this.sources.join('|') };
        this._processQS.forEach(el => util.merge(qs, el.call(this)), this);
        this._api('query', qs, null).then((function(d) {
            this.sources.forEach(function(el) {
                if(d[el]) {
                    const data = this[`_${el}Process`].call(this, d[el]);
                    if(data instanceof Array && data.length > 0) {
                        data.forEach(function(e) {
                            const handle = this._handle(e);
                            if(handle instanceof Array) {
                                this.transport.send(handle);
                            }
                        }, this);
                    }
                }
            }, this);
        }).bind(this)).catch(error => this._error(error));
    }
    /**
     * Handles RC, log, abuse log etc. entry data
     * @method _handle
     * @private
     * @param {Object} info Information about the entry
     * @return {Array<String>} Array of information to be passed to the transport
     */
    _handle(info) {
        switch(info.type) {
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
            // These aren't actual types, they are inserted manually
            // so we don't have to rely on them being undefined
            case 'new wiki': return ['newwikis', info.domain];
            case 'abuse log': return ['abuselog', info.user, info.filter_id, info.filter, info.action, info.title, this.strings[`action-${info.result}`]];
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
    /**
     * Get name
     * @return {String} Name
     */
    get name() {
        return this._name;
    }
    /**
     * Get wiki information
     * @return {Object} Wiki information
     */
    get info() {
        return this._info;
    }
}

module.exports = Wiki;
