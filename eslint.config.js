const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', '.expo/*'],
    rules: {
      'react/no-unescaped-entities': 'off',
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
]);

