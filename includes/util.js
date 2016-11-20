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
     * Returns a link to a wiki
     * @method linkToWiki
     * @static
     * @param {String} wiki The wiki subdomain
     * @return {String} Full link
     */
    static linkToWiki(wiki) {
        return `http://${wiki}.wikia.com`;
    }
    /**
     * Returns a link to a page on a wiki
     * @method linkToArticle
     * @static
     * @param {String} wiki The wiki subdomain
     * @param {String} page The page to link to
     * @return {String} Full link
     */
    static linkToArticle(wiki, page) {
        return `${Util.linkToWiki(wiki)}/wiki/${Util.encodePageName(page)}`;
    }
    /**
     * Returns a link to a diff
     * @method linkToDiff
     * @static
     * @param {String} wiki The wiki subdomain
     * @param {String} id The diff ID
     * @return {String} Full link
     */
    static linkToDiff(wiki, id) {
        return `${Util.linkToWiki(wiki)}/?diff=${id}`;
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
     * @throws {Error} If one of the parameters isn't a string
     */
    static format(msg, args) {
        if(args instanceof Array) {
            args.forEach((el, i) => {
                if(typeof el === 'string' || typeof el === 'number') {
                    msg = msg.replace(new RegExp(`\\$${i + 1}`, 'g'), el);
                }
            }, this);
        }
        return msg;
    }
}

module.exports = Util;
