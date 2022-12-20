const { parserOptions, settings } = require('@n8n_io/eslint-config/shared');

/**
 * @type {import('@types/eslint').ESLint.ConfigData}
 */
module.exports = {
	extends: ['@n8n_io/eslint-config/node'],

	...parserOptions(__dirname),
	...settings(__dirname),

	ignorePatterns: [
		'jest.config.js',
		// TODO: Remove these
		'src/databases/migrations/**',
		'src/databases/ormconfig.ts',
	],

	rules: {
		// TODO: Remove this
		'import/no-cycle': 'warn',
		'import/order': 'off',
		'import/extensions': 'off',
		'@typescript-eslint/ban-ts-comment': ['warn', { 'ts-ignore': true }],
	},
};
