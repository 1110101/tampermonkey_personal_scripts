import js from '@eslint/js';
import userscriptsPlugin from 'eslint-plugin-userscripts';
import globals from 'globals';

export default [
	js.configs.recommended,
	{
		files: ['**/*.js'],
		languageOptions: {
			ecmaVersion: 'latest',
			sourceType: 'module',
			globals: {
				...globals.browser,
				...globals.node,
				// Tampermonkey globals
				GM_addStyle: 'readonly',
				GM_addElement: 'readonly',
				GM_deleteValue: 'readonly',
				GM_getResourceText: 'readonly',
				GM_getResourceURL: 'readonly',
				GM_getValue: 'readonly',
				GM_info: 'readonly',
				GM_listValues: 'readonly',
				GM_log: 'readonly',
				GM_openInTab: 'readonly',
				GM_registerMenuCommand: 'readonly',
				GM_setClipboard: 'readonly',
				GM_setValue: 'readonly',
				GM_unregisterMenuCommand: 'readonly',
				GM_xmlhttpRequest: 'readonly',
				GM_download: 'readonly',
				GM_getTab: 'readonly',
				GM_saveTab: 'readonly',
				GM_getTabs: 'readonly',
				GM_notification: 'readonly',
				GM_addValueChangeListener: 'readonly',
				GM_removeValueChangeListener: 'readonly',
				unsafeWindow: 'readonly',
				cloneInto: 'readonly',
				exportFunction: 'readonly',
			},
		},
		rules: {
			'no-console': 'off',
			indent: ['error', 'tab', { SwitchCase: 1 }],
			quotes: ['error', 'single'],
			'max-len': ['error', { code: 180, ignoreUrls: true, ignoreStrings: false }],
			'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
			'prefer-const': 'error',
			'no-var': 'error',
			'object-shorthand': 'error',
			'prefer-arrow-callback': 'error',
			'arrow-spacing': 'error',
			'brace-style': ['error', '1tbs'],
			'comma-dangle': ['error', 'always-multiline'],
			'eol-last': 'error',
			'no-trailing-spaces': 'error',
			'no-empty': ['error', { allowEmptyCatch: true }],
			'semi': ['error', 'always'],
		},
	},
	{
		files: ['**/*.user.js'],
		plugins: {
			userscripts: userscriptsPlugin,
		},
		rules: {
			...userscriptsPlugin.configs.recommended.rules,
			'max-len': 'off', // Allow longer lines in userscripts for URLs, selectors, etc.
		},
	},
	{
		ignores: ['node_modules/**', '*.min.js'],
	},
];
