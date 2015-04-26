'use strict';

var fs = require('fs');
var path = require('path');
var yargs = require('yargs');
var packageJson = require('../package.json');
var runner = require('./runner.js');

var argv = yargs
	.usage('Usage: $0 --config custom.config.json')
	.option('config', {
		alias: 'c',
		describe: 'A configuration file',
		type: 'string',
		default: '.mbc.js'
	})
	.version(function() {
		return 'Mocha Babel Coverage (mbc) \nv' + packageJson.version;
	})
	.help('h')
	.alias('h', 'help')
	.argv;

var configFile = path.resolve(argv.config);

fs.access(configFile, fs.R_OK, function(err) {
	var options;
	if (err) {
		console.log('Error reading configuration file: ' + argv.config);
		console.log('Using default config');
		options = {};
	} else {
		try {
			options = require(configFile);
		} catch(e) {
			console.log('Error loading configuration file: ' + argv.config);
			process.exit(1);
		}
	}
	runner(options);
});
