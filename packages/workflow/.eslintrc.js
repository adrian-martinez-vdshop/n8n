const { parserOptions, settings } = require('@n8n_io/eslint-config/shared');

/**
 * @type {import('@types/eslint').ESLint.ConfigData}
 */
module.exports = {
	extends: ['@n8n_io/eslint-config/base'],

	...parserOptions(__dirname),
	...settings(__dirname),

	rules: {
		'import/order': 'off', // TODO: remove this
	},
};
