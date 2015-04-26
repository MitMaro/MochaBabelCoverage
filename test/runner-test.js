// jscs:disable disallowAnonymousFunctions, requirePaddingNewLinesInObjects
/* eslint-disable no-unused-expressions */
'use strict';
var fs = require('fs');
var path = require('path');
var rewire = require('rewire');
var MochaJSXRunner = rewire('../src/runner');

describe('Mocha JSX Runner', function() {
	var sourceStoreStub;
	var MochaStub;
	var mochaStub;
	var GlobStub;
	var IstanbulStub;
	var collectorStub;
	var instrumenterStub;
	var reporterStub;
	var ModuleStub;
	var fsStub;
	var pathStub;
	var babelStub;

	beforeEach(function() {
		sourceStoreStub = {
			set: sinon.stub()
		};

		mochaStub = {
			addFile: sinon.stub(),
			run: sinon.stub()
		};

		MochaStub = sinon.stub();
		MochaStub.prototype = mochaStub;

		GlobStub = {
			sync: sinon.stub()
		};

		collectorStub = sinon.stub();
		collectorStub.add = sinon.stub();

		instrumenterStub = {
			instrumentSync: sinon.stub()
		};

		reporterStub = {
			writeReport: sinon.stub()
		};

		IstanbulStub = {
			Instrumenter: sinon.stub(),
			Report: {
				create: sinon.stub().returns(reporterStub)
			},
			Collector: collectorStub,
			Store: {
				create: sinon.stub().returns('memory')
			}
		};

		ModuleStub = {
			_extensions: [],
			_compile: sinon.stub()
		};

		babelStub = {
			transform: sinon.stub()
		};

		pathStub = {
			resolve: sinon.stub().returnsArg(0)
		};

		fsStub = {
			readFileSync: sinon.stub()
		};

		MochaJSXRunner.__set__('Mocha', MochaStub);
		MochaJSXRunner.__set__('glob', GlobStub);
		MochaJSXRunner.__set__('Istanbul', IstanbulStub);
		MochaJSXRunner.__set__('Module', ModuleStub);
		MochaJSXRunner.__set__('babel', babelStub);
		MochaJSXRunner.__set__('fs', fsStub);
		MochaJSXRunner.__set__('path', pathStub);
	});

	describe('#padRight', function() {
		var padRight;

		beforeEach(function() {
			padRight = MochaJSXRunner.__get__('padRight');
		});

		it('should pad short string', function() {
			expect(padRight('aaa', 6)).to.equal('aaa   ');
		});

		it('should pad long string', function() {
			expect(padRight('aaaaaaa', 6)).to.equal('aaaaaaa');
		});
	});

	describe('#addSourceComments', function() {
		var addSourceComments;

		beforeEach(function() {
			addSourceComments = MochaJSXRunner.__get__('addSourceComments');
		});

		it('should accept simple single line mapping', function() {
			var src = fs.readFileSync(path.join(__dirname, 'files', 'addSourceComments-1.js'), {
				encoding: 'utf8'
			});

			var expected = fs.readFileSync(path.join(__dirname, 'files', 'addSourceComments-1.result.js'), {
				encoding: 'utf8'
			});

			expect(addSourceComments(src)).to.equal(expected);
		});

		it('should accept mulit-line mapping', function() {
			var src = fs.readFileSync(path.join(__dirname, 'files', 'addSourceComments-2.js'), {
				encoding: 'utf8'
			});

			var expected = fs.readFileSync(path.join(__dirname, 'files', 'addSourceComments-2.result.js'), {
				encoding: 'utf8'
			});

			expect(addSourceComments(src)).to.equal(expected);
		});
	});

	describe('#initMocha', function() {
		var initMocha;

		beforeEach(function() {
			initMocha = MochaJSXRunner.__get__('initMocha');
		});

		it('should accept globs and files', function() {
			var globs = [
				'ab', 'cd'
			];

			GlobStub.sync.onCall(0).returns(['a', 'b']);
			GlobStub.sync.onCall(1).returns(['c',]);

			var result = initMocha(mochaStub, globs, {
				require: []
			});

			expect(GlobStub.sync).to.be.calledWith(globs[0]);
			expect(GlobStub.sync).to.be.calledWith(globs[1]);
			expect(mochaStub.addFile).to.be.calledWith('a');
			expect(mochaStub.addFile).to.be.calledWith('b');
			expect(mochaStub.addFile).to.be.calledWith('c');
			expect(result).to.eql(mochaStub);
		});

		it('should accept no globs', function() {
			var globs = [];
			var result = initMocha(mochaStub, globs, {
				require: []
			});

			expect(GlobStub.sync).to.not.be.called;
			expect(mochaStub.addFile).to.not.be.called;
			expect(result).to.eql(mochaStub);
		});

		it('should accept no files', function() {
			var globs = [
				'ab'
			];
			var opts = {
				foo: 'bar'
			};

			GlobStub.sync.onCall(0).returns([]);

			var result = initMocha(mochaStub, globs, {
				require: []
			});

			expect(GlobStub.sync).to.be.calledWith(globs[0]);
			expect(mochaStub.addFile).to.not.be.called;
			expect(result).to.eql(mochaStub);
		});

		it('should require files', function() {
			// mocking require is not fun....
			var requireStub = sinon.stub().returns('foo content');
			var globs = [
				'ab'
			];
			var opts = {
				foo: 'bar'
			};

			GlobStub.sync.onCall(0).returns([]);

			require.extensions['.dummy'] = requireStub;
			var result = initMocha(mochaStub, globs, {
				require: [
					path.resolve(__dirname + '/files/dummy.dummy')
				]
			});

			expect(requireStub).to.be.called;
			expect(result).to.eql(mochaStub);
		});
	});

	describe('#initIstanbulCallback', function() {
		var initIstanbulCallback;
		var coverageVariable = '__istanbul_coverage__';

		beforeEach(function() {
			delete global[coverageVariable];
			initIstanbulCallback = MochaJSXRunner.__get__('initIstanbulCallback');
		});

		afterEach(function() {
			delete global[coverageVariable];
		});

		it('should accept no reporters', function() {
			var callback = initIstanbulCallback(sourceStoreStub, collectorStub, {
				istanbul: {
					coverageVariable: coverageVariable,
					reporters: {}
				}
			});
			callback();

			expect(collectorStub.add).to.be.called;
			expect(IstanbulStub.Report.create).to.not.be.called;
			expect(reporterStub.writeReport).to.not.be.called;
			expect(global[coverageVariable]).to.eql({});
		});

		it('should accept reporters', function() {
			var callback = initIstanbulCallback(sourceStoreStub, collectorStub, {
				istanbul: {
					coverageVariable: coverageVariable,
					reporters: {
						html: {},
						text: {}
					}
				}
			}, sourceStoreStub);
			callback();

			expect(collectorStub.add).to.be.called;
			expect(IstanbulStub.Report.create).to.be.calledTwice;
			expect(reporterStub.writeReport).to.be.calledTwice;
			expect(global[coverageVariable]).to.eql({});
		});
	});

	describe('#initModuleRequire', function() {
		var initModuleRequire;
		var moduleExtension;

		beforeEach(function() {
			initModuleRequire = MochaJSXRunner.__get__('initModuleRequire');

			moduleExtension = initModuleRequire(instrumenterStub, sourceStoreStub, {
				babelInclude: ['**/babel_include/**'],
				babelExclude: ['**/babel_exclude/**'],
				babel: {},
				istanbul: {
					exclude: ['**/istanbul_exclude/**']
				}
			});
		});

		it('should accept babel unmatching file that is not babel excluded', function() {
			fsStub.readFileSync.returns('source file content');

			moduleExtension(ModuleStub, '/istanbul_exclude/');

			expect(fsStub.readFileSync).to.be.called;
			expect(babelStub.transform).to.not.be.called;
			expect(instrumenterStub.instrumentSync).to.not.be.called;
			expect(ModuleStub._compile).to.be.calledWith('source file content', '/istanbul_exclude/');
		});

		it('should accept babel matching file that is not babel excluded', function() {
			fsStub.readFileSync.returns('source file content');
			babelStub.transform.returns({
				code: 'babel source file content'
			})

			moduleExtension(ModuleStub, '/babel_include/istanbul_exclude/');

			expect(fsStub.readFileSync).to.be.called;
			expect(babelStub.transform).to.be.calledWith('source file content', {
				filename: '/babel_include/istanbul_exclude/'
			});
			expect(instrumenterStub.instrumentSync).to.not.be.called;
			expect(ModuleStub._compile).to.be.calledWith('babel source file content', '/babel_include/istanbul_exclude/');
		});

		it('should accept non-matching babel file that is istanbul included', function() {
			fsStub.readFileSync.returns('source file content');
			instrumenterStub.instrumentSync.returns('istanbul instrumenter source file stub')

			moduleExtension(ModuleStub, '/babel_exclude/istanbul_include/');

			expect(fsStub.readFileSync).to.be.called;
			expect(babelStub.transform).to.not.be.called;
			expect(instrumenterStub.instrumentSync).to.be.calledWith('source file content', '/babel_exclude/istanbul_include/');
			expect(ModuleStub._compile).to.be.calledWith('istanbul instrumenter source file stub', '/babel_exclude/istanbul_include/');
		});

		it('should accept matching babel file that is istanbul included', function() {
			fsStub.readFileSync.returns('source file content');
			babelStub.transform.returns({
				code: 'babel source file content'
			})
			instrumenterStub.instrumentSync.returns('istanbul instrumenter source file stub')

			moduleExtension(ModuleStub, '/babel_include/istanbul_include/');

			expect(fsStub.readFileSync).to.be.called;
			expect(babelStub.transform).to.be.calledWith('source file content', {
				filename: '/babel_include/istanbul_include/'
			});
			expect(instrumenterStub.instrumentSync).to.be.calledWith('babel source file content', '/babel_include/istanbul_include/');
			expect(ModuleStub._compile).to.be.calledWith('istanbul instrumenter source file stub', '/babel_include/istanbul_include/');
		});

		it('should convert tabs', function() {
			fsStub.readFileSync.returns('\t\tabc\n\tdef');

			moduleExtension(ModuleStub, '/babel_exclude/istanbul_exclude/');

			expect(fsStub.readFileSync).to.be.called;
			expect(ModuleStub._compile).to.be.calledWith('    abc\n  def', '/babel_exclude/istanbul_exclude/');
		});

		it('should catch a babel error', function() {
			fsStub.readFileSync.returns('source file content');
			babelStub.transform.throws(new Error('msg'));

			expect(moduleExtension.bind(null, ModuleStub, '/babel_include/istanbul_exclude/'))
				.to.throw('Error during babel transform - /babel_include/istanbul_exclude/: \nmsg');
		});

		it('should catch a babel error', function() {
			fsStub.readFileSync.returns('source file content');
			instrumenterStub.instrumentSync.throws(new Error('msg'));

			expect(moduleExtension.bind(null, ModuleStub, '/babel_exclude/istanbul_include/'))
				.to.throw('Error during istanbul instrument - /babel_exclude/istanbul_include/: \nmsg');
		});

	});

	describe('#defaults', function() {
		var defaults;

		beforeEach(function() {
			defaults = MochaJSXRunner.__get__('defaults');
		});

		it('should have defaults when no options provided', function() {
			var opts = defaults({});

			expect(opts).to.eql({
				tests: ['test/**/*.js'],
				istanbul: {
					directory: 'coverage',
					reporters: {
						html: {},
						text: {}
					},
					collector: {},
					instrumenter: {
						coverageVariable: '__istanbul_coverage__'
					},
					coverageVariable: '__istanbul_coverage__',
					exclude: [
						'**/test/**/*.js',
						'**/node_modules/**/*'
					]
				},
				mocha: {
					"require": []
				},
				babel: {
					sourceMap: 'inline'
				},
				babelInclude: ['**/*.jsx', '**/*.js'],
				babelExclude: ['**/node_modules/**/*']
			});
		});

		it('should accept tests array option', function() {
			var opts = defaults({
				tests: ['abc']
			});

			expect(opts.tests).to.eql(['abc']);
			expect(opts.istanbul.exclude).to.eql([
				'**/abc',
				'**/node_modules/**/*'
			]);
		});

		it('should accept tests string option', function() {
			var opts = defaults({
				tests: 'abc'
			});

			expect(opts.tests).to.eql(['abc']);
			expect(opts.istanbul.exclude).to.eql([
				'**/abc',
				'**/node_modules/**/*'
			]);
		});

		it('should override istanbul directory', function() {
			var opts = defaults({
				istanbul: {
					directory: 'foo',
					reporters: {
						foo: {}
					},
					collector: {
						abar: 'avalue'
					},
					instrumenter: {
						bbar: 'bvalue'
					},
					coverageVariable: 'coverVar',
					exclude: [
						'lkj'
					]
				}
			});

			expect(opts.istanbul).to.eql({
				directory: 'foo',
				reporters: {
					foo: {}
				},
				collector: {
					abar: 'avalue'
				},
				instrumenter: {
					bbar: 'bvalue',
					coverageVariable: 'coverVar'
				},
				coverageVariable: 'coverVar',
				exclude: [
					'lkj',
					'**/test/**/*.js',
					'**/node_modules/**/*'
				]
			});
		});

		it('should add exclude properly with tests leading with ** or /', function() {
			var opts = defaults({
				tests: [
					'**/abc',
					'/abc'
				]
			});

			expect(opts.istanbul.exclude).to.eql([
				'**/abc',
				'/abc',
				'**/node_modules/**/*'
			]);
		});

		it('should accept string babel include and exclude', function() {
			var opts = defaults({
				babel: {
					include: 'abc',
					exclude: 'def'
				}
			});

			expect(opts.babelInclude).to.eql(['abc']);
			expect(opts.babelExclude).to.eql([
				'def',
				'**/node_modules/**/*'
			]);
		});

		it('should override mocha options', function() {
			var opts = defaults({
				mocha: {
					foo: 'bar'
				}
			});

			expect(opts.mocha).to.eql({
				foo: 'bar',
				require: []
			});
		});

		it('should override mocha require as string', function() {
			var opts = defaults({
				mocha: {
					foo: 'bar',
					require: 'foo'
				}
			});

			expect(opts.mocha).to.eql({
				foo: 'bar',
				require: ['foo']
			});
		});

		it('should override mocha require as array', function() {
			var opts = defaults({
				mocha: {
					foo: 'bar',
					require: ['foo', 'bar']
				}
			});

			expect(opts.mocha).to.eql({
				foo: 'bar',
				require: ['foo', 'bar']
			});
		});

		it('should accept babel options', function() {
			var opts = defaults({
				babel : {
					foo: 'value'
				}
			});

			expect(opts.babel).to.eql({
				sourceMap: 'inline',
				foo: 'value'
			});
		});

		it('should convert grep string to array', function() {
			var opts = defaults({
				mocha : {
					grep: 'value'
				}
			});

			expect(opts.mocha.grep).to.eql([/value/]);
		});

		it('should not convert grep regexs', function() {
			var opts = defaults({
				mocha : {
					grep: [/value/]
				}
			});

			expect(opts.mocha.grep).to.eql([/value/]);
		});
	});

	describe('#run', function() {
		var run;
		var defaultsStub;
		var initMochaStub;
		var initModuleRequireStub;
		var initIstanbulCallbackStub;

		beforeEach(function() {
			defaultsStub = sinon.stub();
			defaultsStub.returnsArg(0);
			initMochaStub = sinon.stub();
			initModuleRequireStub = sinon.stub();
			initIstanbulCallbackStub = sinon.stub();
			run = MochaJSXRunner.__get__('run');
			MochaJSXRunner.__set__('defaults', defaultsStub);
			MochaJSXRunner.__set__('initMocha', initMochaStub);
			MochaJSXRunner.__set__('initModuleRequire', initModuleRequireStub);
			MochaJSXRunner.__set__('initIstanbulCallback', initIstanbulCallbackStub);
		});

		it('should should', function() {
			var opts = {
				tests: 'tests',
				istanbul: {
					instrumenter: 'instrumenter',
					collector: 'collector'
				},
				mocha: 'mocha'
			};
			var istanbulCallback = {};
			initIstanbulCallbackStub.returns(istanbulCallback);

			run(opts);

			expect(defaultsStub).to.be.called;
			expect(IstanbulStub.Instrumenter).to.be.called;
			expect(IstanbulStub.Collector).to.be.called;
			expect(initMochaStub).to.be.called;
			expect(initModuleRequireStub).to.be.called;
			expect(initIstanbulCallbackStub).to.be.called;
			expect(mochaStub.run).to.be.called;

		});
	});
});
