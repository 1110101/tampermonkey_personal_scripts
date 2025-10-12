const js = require('@eslint/js');

module.exports = [
	js.configs.recommended,
	{
		files: ['**/*.js', '**/*.user.js'],
		ignores: [
			'node_modules/**',
			'*.min.js',
			'*.bundle.js',
			'coverage/**',
			'dist/**',
			'build/**',
			'.git/**',
			'.vscode/**',
			'.idea/**',
			'*.log',
			'package-lock.json',
			'yarn.lock',
			'pnpm-lock.yaml'
		],
		languageOptions: {
			ecmaVersion: 2025,
			sourceType: 'script',
			globals: {
				// Node.js globals for config file
				require: 'readonly',
				module: 'readonly',
				exports: 'readonly',
				__dirname: 'readonly',
				__filename: 'readonly',
				process: 'readonly',
				Buffer: 'readonly',
				global: 'readonly'
			}
		},
		rules: {
			// Basic rules
			'no-unused-vars': ['error', {
				'argsIgnorePattern': '^_',
				'varsIgnorePattern': '^_',
				'caughtErrorsIgnorePattern': '^_'
			}],
			'no-undef': 'error',
			'no-console': 'warn',
			'no-alert': 'warn',

			// Stylistic rules
			'indent': ['error', 'tab', {
				'SwitchCase': 1,
				'VariableDeclarator': 1,
				'outerIIFEBody': 1,
				'FunctionDeclaration': { 'parameters': 1, 'body': 1 },
				'FunctionExpression': { 'parameters': 1, 'body': 1 },
				'CallExpression': { 'arguments': 1 },
				'ArrayExpression': 1,
				'ObjectExpression': 1,
				'ImportDeclaration': 1,
				'flatTernaryExpressions': false,
				'ignoreComments': false
			}],
			'quotes': ['error', 'single', { 'avoidEscape': true, 'allowTemplateLiterals': true }],
			'semi': ['error', 'always'],
			'max-len': ['error', {
				'code': 120,
				'tabWidth': 4,
				'ignoreUrls': true,
				'ignoreStrings': true,
				'ignoreTemplateLiterals': true,
				'ignoreRegExpLiterals': true,
				'ignoreComments': true
			}],
			'no-trailing-spaces': 'error',
			'no-mixed-spaces-and-tabs': 'error',
			'comma-dangle': ['error', 'never'],
			'object-curly-spacing': ['error', 'always'],
			'array-bracket-spacing': ['error', 'never'],
			'comma-spacing': ['error', { 'before': false, 'after': true }],
			'key-spacing': ['error', { 'beforeColon': false, 'afterColon': true }],
			'keyword-spacing': ['error', { 'before': true, 'after': true }],
			'space-before-function-paren': ['error', {
				'anonymous': 'always',
				'named': 'never',
				'asyncArrow': 'always'
			}],
			'space-infix-ops': 'error',
			'curly': ['error', 'all'],
			'eqeqeq': ['error', 'always'],

			// ES6+ features
			'prefer-const': 'error',
			'prefer-arrow-callback': 'error',
			'prefer-template': 'error',
			'prefer-destructuring': ['error', {
				'array': true,
				'object': true
			}, {
				'enforceForRenamedProperties': false
			}],
			'arrow-spacing': ['error', { 'before': true, 'after': true }],
			'template-curly-spacing': ['error', 'never'],
			'rest-spread-spacing': ['error', 'never'],

			// Userscript specific
			'no-eval': 'error',
			'no-implied-eval': 'error',
			'no-new-func': 'error'
		}
	},
	{
		files: ['**/*.user.js', '**/*.js'],
		ignores: ['eslint.config.js', 'node_modules/**'],
		languageOptions: {
			ecmaVersion: 2025,
			sourceType: 'script',
			globals: {
				// Browser environment globals (built-in)
				...require('globals').browser,
				// Tampermonkey specific globals
				GM_addStyle: 'readonly',
				GM_setValue: 'readonly',
				GM_getValue: 'readonly',
				GM_deleteValue: 'readonly',
				GM_registerMenuCommand: 'readonly',
				GM_xmlhttpRequest: 'readonly',
				unsafeWindow: 'readonly'
			}
		},
		rules: {
			// Override some rules for userscripts
			'no-console': 'warn', // Allow console for debugging
			'no-alert': 'warn' // Allow alert for notifications
		}
	}
];
