# Mocha Babel Coverage

[![Dependency Status](https://david-dm.org/MitMaro/MochaBabelCoverage.svg)](https://david-dm.org/MitMaro/MochaBabelCoverage)
[![Build Status](https://travis-ci.org/MitMaro/MochaBabelCoverage.svg?branch=master)](https://travis-ci.org/MitMaro/MochaBabelCoverage)
[![Coverage Status](https://coveralls.io/repos/MitMaro/MochaBabelCoverage/badge.svg?branch=master)](https://coveralls.io/r/MitMaro/MochaBabelCoverage?branch=master)

This project allows for the running of tests that compiles source files containing ES6 (including JSX) files before running the tests. It is unique in that it will add the source lines of the files compiled with Babel as a comment after the generated lines.

## Usage

```
mbc [--config ]
```

## Config

```javascript
module.exports = {
	tests: ['tests/**/*.js'],
	istanbul: {
		directory: 'coverage',
		reporters: {
			html: {},
			text: {}
		},
		collector: {},
		instrumenter: {},
		coverageVariable: '__istanbul_coverage__',
		exclude: ['node_modules/**/*']
	},
	mocha: {
		require: ['./mocha-bootstrap.js']
	},
	babel: {
		sourceMap: 'inline',
		include: ['**/*.jsx', '**/*.js'],
		exclude: ['**/node_modules/**/*']
	}
};
```

## License

Mocha Babel Coverage is released under the ISC license. See LICENSE.