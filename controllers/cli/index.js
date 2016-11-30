/**
 * index.js
 * Main script for the CLI module
 */
'use strict';

/**
 * Importing modules
 */
const Controller = require('../controller.js');

/**
 * Main class for the CLI controller
 * @class CLI
 * @augments Controller
 */
class CLI extends Controller {
    /**
     * Class constructor
     * @constructor
     */
    constructor(log) {
        super(log);
        this._read = require('readline').createInterface({
        	input: process.stdin,
        	output: process.stdout
        });
        this.running = true;
        let env = process.env;
        console.info(`
            =====
            Welcome to ${env.npm_package_name} v${env.npm_package_version}!
            Documentation can be found at ${env.npm_package_homepage}
            =====
        `.replace(/( |\t)( |\t)+/g, ''));
    }
    /**
     * Reads a line from the console
     * @method _readLine
     * @private
     */
    _readLine() {
        this._read.question('> ', (function(command) {
            if(typeof command === 'string' && command.trim().length > 0) {
                let split = command.trim().split(' '),
                    comm = split.splice(0, 1)[0];
                this._processCommand(comm, split);
            }
            this._readLine();
        }).bind(this));
    }
    /**
     * Processes CLI message
     * @method _processCommand
     * @static
     * @param {String} command
     * @param {Array<String>} args
     */
    _processCommand(command, args) {
        if(command[0] === '#') {
            let wiki = this._log.wikis.filter(wiki => wiki.name === command.substring(1))[0];
            if(wiki) {
                switch(args[0]) {
                    case 'destroy':
                    case 'close':
                    case 'exit':
                    case 'shutdown':
                    case 'quit':
                    case '>:O':
                        wiki.destroy();
                        this._log.removeWiki(wiki);
                        break;
                    default: this._eventError('No such command found!', 'CLI', '_processCommand');
                }
            } else {
                this._eventError('No such wiki found!', 'CLI', '_processCommand');
            }
        } else {
            switch(command) {
                case 'destroy':
                case 'close':
                case 'exit':
                case 'shutdown':
                case 'quit':
                case '>:O':
                    console.log('Shutting down process...');
                    process.exit();
                    break;
                case 'crash':
                    console.log('If that\'s what you want...');
                    process.crash();
                    break;
                case 'restart':
                case 'reboot':
                case 'reload':
                    console.log('Restarting...');
                    this._log.destroy();
                    this._log.initialize();
                    break;
                case 'info':
                    let env = process.env;
                    console.info(`
                        == Package info
                        ${env.npm_package_name} v${env.npm_package_version}
                        Description: ${env.npm_package_description}
                        Author: ${env.npm_package_author_name}
                        Homepage: ${env.npm_package_homepage}
                        License: ${env.npm_package_license}
                        == Running info
                        Currently watched wikis: ${this._log.wikis.map(wiki => wiki.name).join(', ')}
                        Account: ${this._log.account || 'Not logged in'}
                    `.replace(/( |\t)( |\t)+/g, ''));
                    break;
                default: this._eventError('No such command found!', 'CLI', '_processCommand');
            }
        }
    }
    /**
     * Event called when an error occurs
     * @method _eventError
     * @private
     * @param {String} error Error that occurred
     * @param {String} modul Module in which the error occurred
     * @param {String} method Method in which the error occurred
     */
    _eventError(error, modul, method) {
        console.error(`${error} (${modul}.${method})`);
    }
    /**
     * Event called when user needs to enter a password
     * @method _eventEnterPassword
     * @private
     * @param {String} user User name of the user whose password should be entered
     * @param {Function} callback Callback after the password has been entered
     * @todo Hide entered characters
     */
    _eventEnterPassword(user, callback) {
        this._read.question(`Please enter the password for ${user}: `, (function(password) {
            if(typeof password === 'string' && password.trim().length > 0 && typeof callback === 'function') {
                callback.call(this._log, password.trim());
            } else {
                console.warn('Password not supplied!');
                this._eventEnterPassword(user, callback); // TODO: Recursion much?
            }
        }).bind(this));
    }
    /**
     * Event called when user logs in
     * @method _eventLogin
     * @private
     */
    _eventLogin() {
        console.log('Successfully logged in! Initializing wiki listeners...');
        this._readLine();
    }
    /**
     * Event called when an internal mechanism error occurs
     * @method _eventThrow
     * @private
     * @param {Error} error Error to throw
     */
    _eventThrow(error) {
        console.error(error.stack);
    }
    /**
     * Event called from a {@link Wiki} object
     * @method _eventWiki
     * @private
     * @param {String} e Event thrown
     * @param {Wiki} wiki Wiki from which the event is called
     * @param {Array} args Array of arguments
     */
    _eventWiki() {
        let args = Array.prototype.slice.call(arguments),
            spliced = args.splice(0, 2),
            wiki = spliced[0],
            e = spliced[1];
        switch(e) {
            case 'error':
                console.error(`[${wiki.name}]\n${args[0]}`);
                break;
            case 'initInterval':
                console.info(`[${wiki.name}] Update interval initiated!`);
                break;
            case 'initStart':
                console.info(`[${wiki.name}] Initiating...`);
                break;
            default: this._eventError('No such wiki event!', 'CLI', '_eventWiki');
        }
    }
    /**
     * Event thrown when no wikis are configured
     * @method _eventNoWikis
     * @private
     */
    _eventNoWikis() {
        console.warn('No wikis configured! Exiting program...');
        process.exit();
    }
}

module.exports = CLI;
