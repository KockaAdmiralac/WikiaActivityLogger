/**
 * io.js
 * Module for HTTP communication
 */
'use strict';

/**
 * Importing modules
 */
const http = require('request-promise-native');

/**
 * Static class for handling HTTP requests
 * @class IO
 */
class IO {
    /**
     * Class constructor
     * @constructor
     * @throws {Error} when called
     */
    constructor() {
        main.hook('error', 'This is a static class!', 'IO', 'constructor');
    }
    /**
     * Makes a new cookie jar
     * Cookies made separately
     * @method getNewJar
     * @return {Object} New cookie jar
     */
    static makeJar() {
        IO.jar = http.jar();
    }
    /**
     * Internal method for handling HTTP requests
     * @method _request
     * @private
     * @param {String} method If to use GET or POST
     * @param {String} url URL to send the HTTP request to
     * @param {Object} data Data to send in the request
     * @param {Function} transform How to transform the data when receieved
     * @return {Promise} Promise on which to listen for response
     */
    static _request(method, url, data, transform, body) {
        const lol = [
                'socket.io sucks',
                'Brandon is a witch',
                'This user agent string is random',
                '69% of people don\'t understand things correctly',
                '"Kocka" means "cube" in Serbian',
                'A cube has 6 sides',
                'Cubes aren\'t Illuminati'
            ],
            options = {
                headers: {
                    'User-Agent': `${process.env.npm_package_name} v${process.env.npm_package_version} (${process.env.npm_package_homepage}) [Did you know? ${lol[Math.floor(Math.random() * lol.length)]}]`
                },
                method: method,
                uri: url,
                json: true,
                jar: IO.jar
            };
        options[body ? 'body' : 'qs'] = data;
        if(transform) {
            options.transform = transform;
        }
        return http(options);
    }
    /**
     * Makes a GET request
     * @param {String} url URL to send the HTTP request to
     * @param {Object} data Data to send in the request
     * @param {Function} transform How to transform the data when receieved
     * @return {Promise} Promise on which to listen for response
     */
    static get(url, data, transform) {
        return IO._request('GET', url, data, transform);
    }
    /**
     * Makes a GET request
     * @param {String} url URL to send the HTTP request to
     * @param {Object} data Data to send in the request
     * @param {Function} transform How to transform the data when receieved
     * @return {Promise} Promise on which to listen for response
     */
    static post(url, data, transform, body) {
        return IO._request('POST', url, data, transform, body);
    }
    /**
     * Calls the MediaWiki API
     * @method api
     * @param {String} wiki Wiki to query
     * @param {String} action Action to use
     * @param {Object} options Other data to supply
     * @param {Function} transform How to transform the data when receieved
     * @param {String} method Method to use when communicating with the API.
     *                        Set to GET by default
     * @return {Promise} Promise on which to listen for response
     */
    static api(wiki, action, options, transform, method) {
        if(typeof action !== 'string') {
            main.hook('error', '`action` parameter invalid', 'IO', 'api');
        }
        options.action = action;
        options.format = 'json';
        return IO._request((method || 'GET'), `http://${wiki}.wikia.com/api.php`, options, function(data) {
            if(data.error) {
                const err = data.error;
                main.hook('error', `MediaWiki API error: ${err.code}: ${err.info}`, 'IO', 'api');
            } else if (typeof data[action] === 'undefined') {
                main.hook('error', 'MediaWiki API returned no data!', 'IO', 'api');
            } else if(typeof transform === 'function') {
                return transform.call(this, data[action]);
            } else {
                return data[action];
            }
        });
    }
}

module.exports = IO;
