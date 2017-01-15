/**
 * index.js
 * Entry point for the program
 */
'use strict';

/**
 * Importing modules
 */
const Logger = require('./main.js'),
      Controller = require('./controllers/cli/index.js');

/**
 * Bot controller
 * @property main
 * @global
 * @type {Controller}
 */
global.main = new Controller(new Logger());

// START!!!
global.main.initialize();
