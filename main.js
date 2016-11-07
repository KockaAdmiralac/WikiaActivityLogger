'use strict';
var wikis = [];
const Wiki = require('./wiki.js'),
	  read = require('readline').createInterface({
  		  input: process.stdin,
		  output: process.stdout
	  });
(() => {
	var config;
	try {
		config = require(`./config.json`);
	} catch(e) {
		console.warn('An error occurred while loading the configuration! Please make sure config.json file in the main directory exists.');
		return;
	}
	if(typeof config.wikis !== 'object') {
		console.warn('No wikis configured! Exiting program...');
		return;
	}
	for(var i in config.wikis) {
		if(config.wikis.hasOwnProperty(i)) {
			wikis.push(new Wiki(i, config.wikis[i]));
		}
	}
	// read.question('?', (answer) => console.log(answer));
})();
