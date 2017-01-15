/**
 * controller.js
 * Module for the class for a controller
 */
'use strict';

/**
 * Base class for other controllers
 * @class Controller
 */
class Controller {
    /**
     * Class constructor
     * @constructor
     * @param {Logger} log Wiki activity logger
     */
    constructor(log) {
        this._log = log;
    }
    /**
     * Initializer
     * @method initialize
     */
    initialize() {
        this._log.initialize();
    }
    /**
     * Calls a controller hook
     * @method hook
     * @param {String} type Hook type
     * @param {Array} args Arguments to pass in the hook
     */
    hook() {
        const args = Array.prototype.slice.call(arguments),
              type = args.splice(0, 1)[0],
              func = this[`_event${type.substring(0, 1).toUpperCase() + type.substring(1)}`];
        if(typeof func === 'function') {
            return func.apply(this, args);
        } else {
            return this._eventNoHook(type);
        }
    }
    /**
     * Event fired when no hook exists for an event
     * @method _eventNoHook
     * @private
     * @throws {Error} If not implemented
     */
    _eventNoHook() {
        throw new Error('Unimplemented method: _eventNoHook');
    }
}

module.exports = Controller;
