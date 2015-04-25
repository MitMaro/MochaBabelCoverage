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

	if (!sourceComment) {
		return source;
	}

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

function initMocha(mocha, testGlobs) {
	var i;
	var j;
	var files;

	for (i = 0; i < testGlobs.length; i++) {
		files = glob.sync(testGlobs[i]);
		for (j = 0; j < files.length; j++) {
			mocha.addFile(files[j]);
		}
	}

	return mocha;
}

function initIstanbulCallback(sourceStore, collector, options) {
	global[options.istanbul.coverageVariable] = {};
	function reporterCallback() {
		collector.add(global[options.istanbul.coverageVariable]);
		_.forOwn(options.istanbul.reporters, function reporterIterator(reporterOptions, name) {
			Istanbul.Report
				.create(name, _.defaults({
					sourceStore: sourceStore, // include this always, not used by every reporter
					dir: options.istanbul.directory // most (all?) reporters use this
				}, reporterOptions))
				.writeReport(collector, true);
		});
	}
	return reporterCallback;
}

function initModuleRequire(instrumenter, sourceStore, options) {
	Module._extensions['.js'] = function moduleExtension(module, filename) {
		var matcher = minimatch.bind(null, filename);
		var src = fs.readFileSync(filename, {
			encoding: 'utf8'
		});

		// replace tabs with spaces
		src = src.replace(/^\t+/gm, function tabsReplace(match) {
			// hard code to 2 spaces per tabs for now, istanbul uses 2
			return match.replace(/\t/g, '  ');
		});
		if (_.any(options.babelInclude, matcher) && !_.any(options.babelExclude, matcher)) {
			options.babel.filename = filename;
			try {
				src = babel.transform(src, options.babel).code;
			} catch (e) {
				throw new Error('Error during babel transform - ' + filename + ': \n' + e.message);
			}
		}
		if (!_.any(options.istanbul.exclude, matcher)) {
			sourceStore.set(filename, addSourceComments(src));
			try {
				src = instrumenter.instrumentSync(src, filename);
			} catch (e) {
				throw new Error('Error during istanbul instrument - ' + filename + ': \n' + e.message);
			}
		}
		module._compile(src, filename);
	};
	return Module._extensions['.js'];
}

function defaults(options) {
	var i;
	var opts = {};
	opts.tests = options.tests? options.tests: ['test/**/*.js'];
	opts.istanbul = _.defaults({}, options.istanbul, {
		directory: 'coverage',
		reporters: {
			html: {},
			text: {}
		},
		collector: {},
		instrumenter: {},
		coverageVariable: '__istanbul_coverage__',
		exclude: []
	});
	opts.istanbul.instrumenter.coverageVariable = opts.istanbul.coverageVariable;

	if (!_.isArray(opts.tests)) {
		opts.tests = [opts.tests];
	}

	if (options.istanbul && options.istanbul.reporters) {
		opts.istanbul.reporters = options.istanbul.reporters;
	}
	
	// add tests directories and node modules to the istanbul ignore
	for (i = 0; i < opts.tests.length; i++) {
		if (opts.tests[i][0] !== '/' && opts.tests[i].substr(0, 2) !== '**') {
			opts.istanbul.exclude.push('**/' + opts.tests[i]);
		} else {
			opts.istanbul.exclude.push(opts.tests[i]);
		}
	}
	opts.istanbul.exclude.push('**/node_modules/**/*');

	opts.mocha = _.defaults({}, options.mocha);
	
	opts.babel = _.defaults({
			sourceMap: 'inline'
		}, options.babel, {
			include: ['**/*.jsx', '**/*.js'],
			exclude: []
		}
	);

	opts.babelInclude = opts.babel.include;
	opts.babelExclude = opts.babel.exclude;

	delete opts.babel.include;
	delete opts.babel.exclude;

	if (!_.isArray(opts.babelInclude)) {
		opts.babelInclude = [opts.babelInclude];
	}

	if (!_.isArray(opts.babelExclude)) {
		opts.babelExclude = [opts.babelExclude];
	}

	opts.babelExclude.push('**/node_modules/**/*');

	return _.cloneDeep(opts);
}

var run = function run(options) {
	var mocha;
	var istanbulCallback;
	var instrumenter;
	var collector;
	var mocha;
	var sourceStore = Istanbul.Store.create('memory');
	var opts = defaults(options);

	instrumenter = new Istanbul.Instrumenter(opts.istanbul.instrumenter);
	collector = new Istanbul.Collector(opts.istanbul.collector);
	mocha = new Mocha(opts.mocha);

	initMocha(mocha, opts.tests);
	initModuleRequire(instrumenter, sourceStore, opts);
	istanbulCallback = initIstanbulCallback(
		sourceStore, collector, opts
	);

	mocha.run(istanbulCallback);
}

module.exports = run;
