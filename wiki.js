'use strict';
const io = require('./io.js'),
      strings = require('./string.json');

let Wiki = function(name, config) {
    if(!(this instanceof Wiki)) {
		throw new Error('This isn\'t a static class! (Wiki.constructor)');
	}
    if(typeof name !== 'string' || typeof config !== 'object') {
        throw new Error('`name` or `config` parameter invalid (Wiki.constructor)');
    }
    if(typeof config.transport === 'object' && typeof config.transport.platform === 'string') {
        let Transport = require(`./transports/${config.transport.platform}.js`);
        this.transport = new Transport(config.transport, name);
        if(typeof this.transport.send !== 'function') {
            throw new Error('Given transport does not utilize `send` method! (Wiki.constructor)');
        }
    } else {
        throw new Error('Transport configuration invalid! (Wiki.constructor)');
    }
    this.name = name;
    this.config = config;
    this.fetch = (this.config.fetch || ['rc', 'log']).map(this.dispatchFetcher.bind(this));
    this.threadCache = {};
    this.log('Fetching threads...');
    this.afterFetch();
    //this.fetchThreads();
};

Wiki.prototype.log = function(message) {
    console.log(`[${this.name}] ${message}`);
};

Wiki.prototype.api = function(action, data, transform) {
    return io.api(this.name, action, data, transform);
};

Wiki.prototype.formatMessage = function(args) {
    let msg = strings[args.splice(0, 1)[0]];
    if(typeof msg !== 'string') {
        throw new Error('Given message isn\'t a string (Wiki.prototype.formatMessage)');
    }
    if(args) {
            args.forEach((el, i) => {
            if(typeof el !== 'string') {
                throw new Error(`Parameter $${i + 1} isn't a string (Wiki.prototype.formatMessage)`);
            }
            msg = msg.replace(`$${i + 1}`, el);
        }, this);
    }
    return msg;
};

Wiki.prototype.link = function(page) {
    return `http://${this.config.shortname || this.name}.wikia.com/wiki/${encodeURIComponent(page.replace(/ /g, '_')).replace(/%3A/g, ':').replace(/%2F/g, '/')}`;
};

Wiki.prototype.threadLink = function(page) {
    let split = page.split('/'),
        threadPage = `${split[0]}/${split[1]}`;
    return this.link(this.threadCache[threadPage] ? `Thread:${this.threadCache[threadPage]}` : page);
};

Wiki.prototype.boardLink = function(page, ns) {
    return this.link(`${ns === 1201 ? 'Message_Wall' : 'Board'}:${page.split(':')[1].split('/')[0]}`);
};

Wiki.prototype.diff = function(id) {
    return `http://${this.config.shortname || this.name}.wikia.com/?diff=${id}`;
};

Wiki.prototype.fetchThreads = function() {
    if(typeof this.config.threadfetch !== 'object') {
        this.config.threadfetch = {};
    }
    if(typeof this.config.threadfetch.method !== 'string') {
        this.config.threadfetch.method = 'api';
    }
    switch(this.config.threadfetch.method) {
        case 'api': return this.fetchThreadsAPI();
        case 'dpl': return this.fetchThreadsDPL();
    }
};

Wiki.prototype.fetchThreadsAPI = function(apfrom, forum) {
    let options = {
        list: 'allpages',
        aplimit: 5000,
        apfilterredir: 'nonredirects',
        apnamespace: forum ? 2001 : 1201
    };
    if(typeof apfrom === 'string') {
        options.apfrom = apfrom;
    }
    this.api('query', options).then((function(data) {
        data.query.allpages.filter((el) => el.title.split('/').length > 2).forEach((el) => {
            this.threadCache[el.title] = el.pageid;
        }, this);
        if(data['query-continue'] && data['query-continue'].allpages && typeof data['query-continue'].allpages.apfrom === 'string') {
            this.fetchThreadsAPI(data['query-continue'].allpages.apfrom, forum);
        } else if(!forum) {
            // If already went through forum threads go to wall threads
            this.fetchThreadsAPI(undefined, true);
        } else {
            this.afterFetch();
        }
    }).bind(this)).catch((error) => { throw error; });
};

Wiki.prototype.generateDPL = function(namespace, index) {
    return `<dpl>\nnamespace=${namespace}\ntitleregexp=\\w+\\/@comment-[^\\/]+$\nshowcurid=true\noffset=${index * 500}</dpl>`;
};

Wiki.prototype.fetchThreadsDPL = function(index) {
    index = index || 0;
    let text = '',
        offset = this.config.threadfetch.offset || 1;
    for(var i = 0; i < offset; ++i) {
        text += this.generateDPL('Thread', index + i) + this.generateDPL('Board_Thread', index + i);
    }
    this.api('parse', { text: text  })
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
                } else {
                    this.afterFetch();
                }
            }
        }.bind(this))
        .catch((error) => { throw error; });
};

Wiki.prototype.afterFetch = function() {
    this.log('Fetched all, initiating...');
    this.fetchRC()
        .then((function(data) {
            if(data.length === 0) {
                throw new Error('Initial returned recent changes empty (Wiki.constructor)');
            } else {
                this.fetchLog()
                    .then(function(data) {
                        if(data.length === 0) {
                            throw new Error('Initial returned log empty (Wiki.constructor)');
                        } else {
                            this.log('Initiated, interval set!');
                            this.interval = setInterval(this.update.bind(this), (this.config.interval || 500));
                        }
                    }.bind(this))
                    .catch((error) => { throw error; });
            }
        }).bind(this))
        .catch((error) => { throw error; });
};

Wiki.prototype.fetchRC = function() {
    let options = {
        list: 'recentchanges',
        rcprop: 'user|title|ids|timestamp|comment|flags|tags|loginfo',
        rcshow: '!bot',
        rclimit: 500
    };
    if(typeof this.rcend === 'string') {
        options.rcend = this.rcend;
    }
    if(typeof this.config.excludeuser === 'string') {
        options.rcexcludeuser = this.config.excludeuser;
    }
    return this.api('query', options, function(data) {
        if(typeof data.query && data.query.recentchanges instanceof Array) {
            let rc = data.query.recentchanges,
                rcdate = new Date(this.rcend);
            if(typeof this.rcend === 'string') {
                rc = rc.filter((el) => new Date(el.timestamp) > rcdate);
            }
            this.rcend = data.query.recentchanges[0].timestamp;
            return rc;
        } else {
            throw new Error(`Recent changes data not valid for w:c:${this.name} (Wiki.prototype.fetchRC)`);
        }
    }.bind(this));
};

Wiki.prototype.fetchLog = function() {
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
    return this.api('query', options, function(data) {
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
    }.bind(this));
};

Wiki.prototype.fetchAbuseLog = function() {
    // TODO: Log in so this thing actually works
    let options = {
        list: 'abuselog',
        aflprop: 'filter|user|title|action|result|timestamp|ids',
        afllimit: 500
    };
    if(typeof this.aflend === 'string') {
        options.aflend = this.aflend;
    }
    return this.api('query', options, function(data) {
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
    }.bind(this));
};

Wiki.prototype.dispatchFetcher = function(type) {
    switch(type) {
        case 'rc':
        case 'recent changes':
            return this.fetchRC;
        case 'log':
            return this.fetchLog;
        case 'abuselog':
        case 'al':
        case 'abuse log':
            return this.fetchAbuseLog;
    }
};

Wiki.prototype.update = function() {
    this.fetch.forEach(function(el) {
        el.call(this)
            .then(function(data) {
                if(data.length > 0) {
                    data.forEach(function(entry) {
                        let result = this.formatMessage(this.handle(entry));
                        if(typeof result === 'string') {
                            this.transport.send(result);
                        }
                    }, this);
                }
            }.bind(this))
            .catch((error) => { throw error; });
    }, this);
};

Wiki.prototype.handle = function (info) {
    switch(info.type) {
        case undefined:
            if(typeof info.filter_id === 'number') {
                // This is an abuse log
                return ['abuselog', info.user, info.filter_id, info.filter, info.action, info.title, strings[`action-${info.result}`]];
            }
            break;
        case 'new':
            // Not a log
            return (info.ns === 1201 || info.ns === 2001) ?
                ['newthread', info.user, this.threadLink(info.title), this.boardLink(info.title, info.ns), info.comment] :
                ['new', info.user, this.link(info.title), info.comment];
        case 'edit':
            // Not a log
            return (info.ns === 1201 || info.ns === 2001) ?
                ['editthread', info.user, info.title, this.boardLink(info.title, info.ns), this.diff(info.revid), info.comment] :
                ['edit', info.user, info.title, this.diff(info.revid), info.comment];
        case 'log':
            if(info.logtype !== '0') {
                return;
            }
            switch(info.logaction) {
                // Why Wikia, why
                case 'wall_remove': return ['threadremove', info.user, this.threadLink(info.title), this.boardLink(info.title, info.ns), info.comment];
                case 'wall_admindelete': return ['threaddelete', info.user, this.threadLink(info.title), this.boardLink(info.title, info.ns), info.comment];
                case 'wall_restore': return ['threadrestore', info.user, this.threadLink(info.title), this.boardLink(info.title, info.ns), info.comment];
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
                case 'restore': return ['restore', info.user, this.link(info.title), info.comment];
            }
            break;
        case 'patrol': break; // Not going to handle this
        case 'move':
            // TODO: move_redir
            switch(info.action) {
                case 'move': return ['move', info.user, this.link(info.title), this.link(info.move.new_title), info.comment];
                case 'move_redir': return ['debug', JSON.stringify(info)];
            }
            break;
        case 'rights':
            // TODO: autopromote, erevoke
            if(info.action === 'autopromote' || info.action === 'erevoke') {
                console.log(info);
            }
            return ['rights', info.user, info.title, info.rights.old, info.rights.new, info.comment];
        case 'upload':
            switch(info.action) {
                case 'upload': return ['upload', info.user, this.link(info.title), info.comment];
                case 'overwrite': return ['reupload', info.user, this.link(info.title), info.comment];
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
        case 'merge': return ['merge', info.title, this.link(info[0]), this.comment];
        case 'abusefilter': return ['abusefilter', info.user, this.link(info.title)];
        case 'wikifeatures': return ['wikifeatures', info.user, info.comment];
        case 'import':
            switch(info.action) {
                case 'interwiki': return ['debug', JSON.stringify(info)];
                case 'upload': return ['import', info.user, this.link(info.title), info.comment]; // TODO
            }
            break;
    }
};

module.exports = Wiki; // jshint ignore: line
