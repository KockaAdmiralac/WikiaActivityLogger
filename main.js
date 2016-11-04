'use strict';
var wikis = [];
const Wiki = require('./wiki.js'),
	  read = require('readline').createInterface({
  		  input: process.stdin,
		  output: process.stdout
	  });

(() => {
	var config = require(`./config.json`);
	for(var i in config) {
		if(config.hasOwnProperty(i)) {
			wikis.push(new Wiki(i, config[i]));
		}
	}
	// read.question('?', (answer) => console.log(answer));
})();
