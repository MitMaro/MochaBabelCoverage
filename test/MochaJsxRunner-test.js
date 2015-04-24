// jscs:disable disallowAnonymousFunctions, requirePaddingNewLinesInObjects
/* eslint-disable no-unused-expressions */
'use strict';
var fs = require('fs');
var path = require('path');
var rewire = require('rewire');
var MochaJSXRunner = rewire('../src/MochaJSXRunner');

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
	var babelStub;


	beforeEach(function() {
		sourceStoreStub = {
			set: sinon.stub()
		};

		mochaStub = {
			addFile: sinon.stub()
		};

		MochaStub = sinon.stub().returns(mochaStub);

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
			Collector: collectorStub
		};

		ModuleStub = {
			_extensions: [],
			_compile: sinon.stub()
		};

		babelStub = {
			transform: sinon.stub()
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
	});

	describe('padRight', function() {
		var padRight;

		beforeEach(function() {
			padRight = MochaJSXRunner.__get__('padRight');
		});

		it('will pad short string', function() {
			expect(padRight('aaa', 6)).to.equal('aaa   ');
		});

		it('will pad long string', function() {
			expect(padRight('aaaaaaa', 6)).to.equal('aaaaaaa');
		});
	});

	describe('addSourceComments', function() {
		var addSourceComments;

		beforeEach(function() {
			addSourceComments = MochaJSXRunner.__get__('addSourceComments');
		});

		it('simple single line mapping', function() {
			var src = fs.readFileSync(path.join(__dirname, 'files', 'addSourceComments-1.js'), {
				encoding: 'utf8'
			});

			var expected = fs.readFileSync(path.join(__dirname, 'files', 'addSourceComments-1.result.js'), {
				encoding: 'utf8'
			});

			expect(addSourceComments(src)).to.equal(expected);
		});

		it('mulit line mapping', function() {
			var src = fs.readFileSync(path.join(__dirname, 'files', 'addSourceComments-2.js'), {
				encoding: 'utf8'
			});

			var expected = fs.readFileSync(path.join(__dirname, 'files', 'addSourceComments-2.result.js'), {
				encoding: 'utf8'
			});

			expect(addSourceComments(src)).to.equal(expected);
		});
	});

	describe('initMocha', function() {
		var initMocha;

		beforeEach(function() {
			initMocha = MochaJSXRunner.__get__('initMocha');
		});

		it('with globs and files', function() {
			var globs = [
				'ab', 'cd'
			];

			GlobStub.sync.onCall(0).returns(['a', 'b']);
			GlobStub.sync.onCall(1).returns(['c',]);

			var result = initMocha(mochaStub, globs);

			expect(GlobStub.sync).to.be.calledWith(globs[0]);
			expect(GlobStub.sync).to.be.calledWith(globs[1]);
			expect(mochaStub.addFile).to.be.calledWith('a');
			expect(mochaStub.addFile).to.be.calledWith('b');
			expect(mochaStub.addFile).to.be.calledWith('c');
			expect(result).to.eql(mochaStub);
		});

		it('with no globs', function() {
			var globs = [];
			var result = initMocha(mochaStub, globs);

			expect(GlobStub.sync).to.not.be.called;
			expect(mochaStub.addFile).to.not.be.called;
			expect(result).to.eql(mochaStub);
		});

		it('with no files', function() {
			var globs = [
				'ab'
			];
			var opts = {
				foo: 'bar'
			};

			GlobStub.sync.onCall(0).returns([]);

			var result = initMocha(mochaStub, globs);

			expect(GlobStub.sync).to.be.calledWith(globs[0]);
			expect(mochaStub.addFile).to.not.be.called;
			expect(result).to.eql(mochaStub);
		});
	});

	describe('initIstanbulCallback', function() {
		var initIstanbulCallback;
		var coverageVariable = '__istanbul_coverage__';

		beforeEach(function() {
			delete global[coverageVariable];
			initIstanbulCallback = MochaJSXRunner.__get__('initIstanbulCallback');
		});

		afterEach(function() {
			delete global[coverageVariable];
		});

		it('no reporters', function() {
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

		it('with reporters', function() {
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

	describe('initModuleRequire', function() {
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

		it('with babel unmatching file that is not babel excluded', function() {
			fsStub.readFileSync.returns('source file content');

			moduleExtension(ModuleStub, '/istanbul_exclude/');

			expect(fsStub.readFileSync).to.be.called;
			expect(babelStub.transform).to.not.be.called;
			expect(instrumenterStub.instrumentSync).to.not.be.called;
			expect(ModuleStub._compile).to.be.calledWith('source file content', '/istanbul_exclude/');
		});

		it('with babel matching file that is not babel excluded', function() {
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

		it('with non-matching babel file that is istanbul included', function() {
			fsStub.readFileSync.returns('source file content');
			instrumenterStub.instrumentSync.returns('istanbul instrumenter source file stub')

			moduleExtension(ModuleStub, '/babel_exclude/istanbul_include/');

			expect(fsStub.readFileSync).to.be.called;
			expect(babelStub.transform).to.not.be.called;
			expect(instrumenterStub.instrumentSync).to.be.calledWith('source file content', '/babel_exclude/istanbul_include/');
			expect(ModuleStub._compile).to.be.calledWith('istanbul instrumenter source file stub', '/babel_exclude/istanbul_include/');
		});

		it('with matching babel file that is istanbul included', function() {
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

		it('can convert tabs', function() {
			fsStub.readFileSync.returns('\t\tabc\n\tdef');

			moduleExtension(ModuleStub, '/babel_exclude/istanbul_exclude/');

			expect(fsStub.readFileSync).to.be.called;
			expect(ModuleStub._compile).to.be.calledWith('    abc\n  def', '/babel_exclude/istanbul_exclude/');
		});

		it('will catch a babel error', function() {
			fsStub.readFileSync.returns('source file content');
			babelStub.transform.throws(new Error('msg'));

			expect(moduleExtension.bind(null, ModuleStub, '/babel_include/istanbul_exclude/'))
				.to.throw('Error during babel transform - /babel_include/istanbul_exclude/: \nmsg');
		});

		it('will catch a babel error', function() {
			fsStub.readFileSync.returns('source file content');
			instrumenterStub.instrumentSync.throws(new Error('msg'));

			expect(moduleExtension.bind(null, ModuleStub, '/babel_exclude/istanbul_include/'))
				.to.throw('Error during istanbul instrument - /babel_exclude/istanbul_include/: \nmsg');
		});

	});
});
