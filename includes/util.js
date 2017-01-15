/**
 * util.js
 * This module contains utilities for the whole project
 */
'use strict';

/**
 * Utilities class
 * @class Util
 */
class Util {
    /**
     * Class constructor
     * @constructor
     * @throws {Error} When called
     */
    constructor() {
        main.hook('error', 'This is a static class!', 'Util', 'constructor');
    }
    /**
     * Throws an incorrect parameters error
     * @method _error
     * @private
     * @static
     * @param {String} method Name of the method that triggered the error
     */
    static _error(method) {
        if(typeof method !== 'string') {
            main.hook('error', 'Ironically, incorrect parameters', 'Util', '_error');
        }
        main.hook('error', 'Incorrect parameters!', 'Util', method);
    }
    /**
     * Returns a link to a page on a wiki
     * @method linkToArticle
     * @static
     * @param {String} wiki The wiki domain
     * @param {String} path Article path of the wiki
     * @param {String} page The page to link to
     * @return {String} Full link
     */
    static linkToArticle(wiki, path, page) {
        return `${wiki}${path.replace(/\$1/g, Util.encodePageName(page))}`;
    }
    /**
     * Returns a link to a diff
     * @method linkToDiff
     * @static
     * @param {String} server The wiki domain
     * @param {String} script The wiki script path
     * @param {String} id The diff ID
     * @return {String} Full link
     */
    static linkToDiff(server, script, id) {
        return `${server}${script}/?diff=${id}`;
    }
    /**
     * Encodes the page name but decodes some characters
     * that get encoded by encodeURIComponent but are
     * recognizable by normal clients
     * @method encodePageName
     * @static
     * @param {String} name The page name
     * @return {String} Encoded page name
     */
    static encodePageName(name) {
        return encodeURIComponent(name)
            .replace(/%3A/g, ':')
            .replace(/%2F/g, '/')
            .replace(/%40/g, '@')
            .replace(/%20/g, '_');
    }
    /**
     * Formats a message using the given format
     * @method format
     * @static
     * @param {String} msg Message format, parameters use dollar annotation
     * @param {Array<String>} args Array with parameters
     * @return {String} Formatted message
     */
    static format(msg, args) {
        if(!(args instanceof Array) || typeof msg !== 'string') {
            Util._error('format');
            return;
        }
        args.forEach(function(el, i) {
            if(typeof el === 'string' || typeof el === 'number') {
                msg = msg.replace(new RegExp(`\\$${i + 1}`, 'g'), el);
            }
        }, this);
        return msg;
    }
    /**
     * Iterates through all keys in an object
     * @method each
     * @static
     * @param {Object} obj Object to iterate through
     * @param {Function} func Callback function
     * @param {Object} context Context in which the callback should be called
     */
    static each(obj, func, context) {
        if(typeof obj !== 'object' && typeof func !== 'function') {
            Util._error('each');
            return;
        }
        for(let i in obj) {
            if(obj.hasOwnProperty(i)) {
                func.call(context || this, i, obj[i]);
            }
        }
    }
    /**
     * Merges two objects. Properties of the first object will be
     * overwritten by properties of the second object
     * @method merge
     * @static
     * @param {Object} obj1 First object
     * @param {Object} obj2 Second object
     * @return {Object} Merged object
     */
    static merge(obj1, obj2) {
        if(typeof obj1 !== 'object' || typeof obj2 !== 'object') {
            Util._error('merge');
            return;
        }
        Util.each(obj2, function(k, v) {
            obj1[k] = v;
        });
        return obj1;
    }
    /**
     * Checks if an array includes an object
     * This is only because Node.js doesn't have Array.prototype.includes
     * unless you supply a harmony flag (or whatever)
     * @method includes
     * @static
     * @param {Array} arr Array to check for the object
     * @param {*} obj Object to check for in the array
     */
    static includes(arr, obj) {
        if(!(arr instanceof Array)) {
            Util._error('includes');
            return;
        }
        return arr.indexOf(obj) !== -1;
    }
    /**
     * Removes an object from an array
     * @method remove
     * @static
     * @param {Array} arr Array from which to remove the object
     * @param {*} obj Object to remove
     * @return {Array} Array with the object removed
     */
    static remove(arr, obj) {
        if(!(arr instanceof Array)) {
            Util._error('remove');
            return;
        }
        const index = arr.indexOf(obj);
        if(index !== -1) {
            arr.splice(index, 1);
        }
        return arr;
    }
}

module.exports = Util;
