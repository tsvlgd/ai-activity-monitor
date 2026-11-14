// Flat config for GJS (GNOME Shell) and Node test code.
export default [
    {
        files: ['**/*.js'],
        languageOptions: {
            ecmaVersion: 2023,
            sourceType: 'module',
            globals: {
                global: 'readonly', log: 'readonly', logError: 'readonly', console: 'readonly',
                TextDecoder: 'readonly', TextEncoder: 'readonly', process: 'readonly', setTimeout: 'readonly', URL: 'readonly',
                globalThis: 'readonly', Symbol: 'readonly', AbortController: 'readonly',
            },
        },
        rules: {
            'no-unused-vars': ['error', {argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none'}],
            'no-undef': 'error',
            'prefer-const': 'error',
            'no-var': 'error',
            eqeqeq: ['error', 'always'],
        },
    },
];
