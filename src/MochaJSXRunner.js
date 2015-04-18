'use strict';

var _ = require('lodash');
var fs = require('fs');
var Module = require('module');
var babel = require('babel');
var Istanbul = require('istanbul');
var Mocha = require('mocha');
var SourceMapConsumer = require('source-map').SourceMapConsumer;
var glob = require('glob');
var minimatch = require('minimatch');

function padRight(str, length) {
	return str + Array(length - str.length + 1).join(' ');
}

function addSourceComments(source) {
	var sourceComment;
	var sourceMap;
	var originalLines;
	var generatedSource;
	var line;
	var lines = [];
	var longestLine = 0;
	var longestLineNumber = 0;
	var outputItems = [];
	var output = [];
	var tmp;
	var i;
	var j;

	generatedSource = source.split('\n');

	sourceComment = source.match(/\n\/\/# sourceMappingURL=data:application\/json;base64,(.+)/);
	sourceMap = new SourceMapConsumer(new Buffer(sourceComment[1], 'base64').toString('utf8'));
	originalLines = sourceMap.sourceContentFor(sourceMap.sources[0]).split('\n');

	for (i = 1; i <= generatedSource.length; i++) {
		lines.push([]);
	}

	sourceMap.eachMapping(function sourceMapIterator(mapping) {
		if (lines[mapping.generatedLine].indexOf(mapping.originalLine) === -1) {
			lines[mapping.generatedLine].push(mapping.originalLine);
		}
	});

	for (i = 1; i < generatedSource.length; i++) {
		tmp = {
			generated: generatedSource[i - 1],
			original: false
		};

		line = '';
		for (j = 0; j < lines[i].length; j++) {
			line += originalLines[lines[i][j] - 1];
		}
		if (line !== '') {
			tmp.original = line;
			if (lines[i].length === 1) {
				tmp.lineNumbers = '// Line:  ' + lines[i][0];
			}
			else {
				tmp.lineNumbers = '// Lines: ' + lines[i].join(',');
			}
			if (tmp.lineNumbers.length > longestLineNumber) {
				longestLineNumber = tmp.lineNumbers.length;
			}
		}

		// get the longest line length
		if (generatedSource[i - 1].length > longestLine) {
			longestLine = generatedSource[i - 1].length;
		}

		outputItems.push(tmp);
	}

	for (i = 0; i < outputItems.length; i++) {
		if (outputItems[i].original) {
			output.push(
				padRight(outputItems[i].generated, longestLine + 3) +
				padRight(outputItems[i].lineNumbers, longestLineNumber + 1) +
				'| ' + outputItems[i].original
			);
		}
		else {
			output.push(outputItems[i].generated);
		}
	}

	return output.join('\n');
}

function initMocha(testGlobs, options) {
	var i;
	var j;
	var files;
	var opts = {};
	var mocha;

	_.merge(opts, options);

	mocha = new Mocha(opts);

	for (i = 0; i < testGlobs.length; i++) {
		files = glob.sync(testGlobs[i]);
		for (j = 0; j < files.length; j++) {
			mocha.addFile(files[j]);
		}
	}

	return mocha;
}

function initIstanbul(options, sourceStore) {
	var instrumenter;
	var opts = {
		directory: 'coverage',
		reporters: {
			html: {},
			text: {}
		},
		coverageVariable: '__istanbul_coverage__'
	};

	_.merge(opts, options);

	global[opts.coverageVariable] = {};
	instrumenter = new Istanbul.Instrumenter(opts);

	function reporterCallback() {
		var collector = new Istanbul.Collector(opts.collector);

		collector.add(global[opts.coverageVariable]);
		_.forOwn(opts.reporters, function reporterIterator(reporterOptions, name) {
			var reporterOpts = {
				sourceStore: sourceStore, // include this always, not used by every reporter
				dir: opts.directory // most (all?) reporters use this
			};

			_.merge(reporterOpts, reporterOptions);
			Istanbul.Report.create(name, reporterOpts).writeReport(collector, true);
		});
	}

	return {
		reporterCallback: reporterCallback,
		instrumenter: instrumenter
	};
}

function initModuleRequire(babelOptions, istanbulOptions, instrumenter, sourceStore) {
	var babelInclude;
	var babelExclude;
	var istanbulOpts;
	var babelOpts = {};

	_.merge(babelOpts, babelOptions, {
		sourceMap: 'inline' // must generate inline source maps
	});
	babelInclude = babelOpts.include || ['**/*.jsx', '**/*.js'];
	babelExclude = babelOpts.exclude || ['**/node_modules/**/*'];
	istanbulOpts = {
		exclude: ['**/node_modules/**/*']
	};

	// babel complains when given unknown options
	delete babelOpts.include;
	delete babelOpts.exclude;
	_.merge(istanbulOpts, istanbulOptions);

	if (!_.isArray(babelInclude)) {
		babelInclude = [babelInclude];
	}

	if (!_.isArray(babelExclude)) {
		babelExclude = [babelExclude];
	}

	if (!_.isArray(istanbulOpts.exclude)) {
		istanbulOpts.exclude = [istanbulOpts.exclude];
	}

	Module._extensions['.js'] = function moduleExtension(module, filename) {
		var matcher = minimatch.bind(null, filename);
		var src = fs.readFileSync(filename, {
			encoding: 'utf8'
		});

		// replace tabs with spaces
		src = src.replace(/^\t+/gm, function tabsReplace(match) {
			// hard code to 2 spaces per tabs for now, istanbul uses 2
			return match.replace(/\t/g, Array(3).join(' '));
		});

		if (_.any(babelInclude, matcher) && !_.any(babelExclude, matcher)) {
			babelOpts.filename = filename;
			try {
				src = babel.transform(src, babelOpts).code;
			} catch (e) {
				throw new Error('Error during babel transform - ' + filename + ': \n' + e.toString());
			}
		}

		if (!_.any(istanbulOpts.exclude, matcher)) {
			sourceStore.set(filename, addSourceComments(src));
			try {
				src = instrumenter.instrumentSync(src, filename);
			} catch (e) {
				throw new Error('Error during istanbul instrument - ' + filename + ': \n' + e.toString());
			}
		}

		module._compile(src, filename);
	};
}

function run(options) {
	var mocha;
	var istanbul;
	var sourceStore = Istanbul.Store.create('memory');
	var istanbulOpts = {
		exclude: ['**/node_modules/**/*'].concat(options.tests)
	};

	_.merge(istanbulOpts, options.istanbul);

	mocha = initMocha(options.tests, options.mocha);
	istanbul = initIstanbul(istanbulOpts, sourceStore);
	initModuleRequire(options.babel, istanbulOpts, istanbul.instrumenter, sourceStore);
	mocha.run(istanbul.reporterCallback);
}
