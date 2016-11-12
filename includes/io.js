/**
 * io.js
 * Module for HTTP communication
 */
'use strict';

/**
 * Importing modules
 */
const http = require('request-promise-native');

class IO {
    /**
     * Class constructor
     * @constructor
     * @throws {Error} when called
     */
    constructor() {
        throw new Error('This is a static class! (IO.constructor)');
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
        let options = {
            method: method,
            uri: url,
            json: true,
            jar: IO.jar
        };
        options[body ? 'body' : 'qs'] = data;
        //options[(method === 'GET') ? 'qs' : 'body'] = data;
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
     * @return {Promise} Promise on which to listen for response
     */
    static api(wiki, action, options, transform, method) {
        if(typeof action !== 'string') {
            throw new Error('`action` parameter invalid (IO.api)');
        }
        options.action = action;
        options.format = 'json';
        return IO._request((method || 'GET'), `http://${wiki}.wikia.com/api.php`, options, function(data) {
            if(data.error) {
                let err = data.error;
                console.error(`MediaWiki API error: ${err.code}: ${err.info}`);
            } else if (typeof data[action] === 'undefined') {
                console.error('MediaWiki API returned no data!');
            } else if(typeof transform === 'function') {
                return transform.call(this, data);
            } else {
                return data;
            }
        });
    }
}

module.exports = IO;
