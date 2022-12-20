/**
 * @type {() => import('@types/eslint').ESLint.ConfigData}
 */
exports.parserOptions = (tsconfigRootDir) => ({
	parserOptions: {
		tsconfigRootDir,
		project: ['./tsconfig.json'],
	},
});

/**
 * @type {() => import('@types/eslint').ESLint.ConfigData}
 */
exports.settings = (tsconfigRootDir) => ({
	settings: {
		'import/parsers': {
			'@typescript-eslint/parser': ['.ts'],
		},

		'import/resolver': {
			typescript: {
				tsconfigRootDir,
				project: './tsconfig.json',
			},
		},
	},
});
