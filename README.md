# Mocha Babel Coverage

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