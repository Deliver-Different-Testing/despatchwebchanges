import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
    // Global ignores
    {
        ignores: [
            'wwwroot/dist/**',
            'wwwroot/lib/**',
            'node_modules/**',
            'bin/**',
            'obj/**',
            '**/*.js',
            '**/*.mjs',
            '**/*.d.ts',
        ],
    },

    // Base ESLint recommended rules
    eslint.configs.recommended,

    // TypeScript recommended rules (type-aware)
    ...tseslint.configs.recommended,

    // TypeScript-specific configuration
    {
        languageOptions: {
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            },
        },
        rules: {
            // Downgrade noisy rules to warnings for gradual adoption
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/no-unused-vars': ['warn', {
                argsIgnorePattern: '^_',
                varsIgnorePattern: '^_',
            }],

            // Allow empty functions (common in Angular services with $get)
            '@typescript-eslint/no-empty-function': 'off',

            // Allow require imports (used in AngularJS lazy loading)
            '@typescript-eslint/no-require-imports': 'off',

            // Disable rules that conflict with the hybrid architecture
            'no-undef': 'off', // TypeScript handles this better

            // Downgrade pre-existing issues to warnings for gradual cleanup
            '@typescript-eslint/no-unsafe-function-type': 'warn',
            '@typescript-eslint/no-empty-object-type': 'warn',
            '@typescript-eslint/no-unused-expressions': 'warn',
            'no-case-declarations': 'warn',
            'no-prototype-builtins': 'warn',
            'no-empty': 'warn',
            'no-useless-assignment': 'warn',
            'no-constant-binary-expression': 'warn',

            // Practical rules that catch real bugs
            'no-debugger': 'error',
            'no-duplicate-case': 'error',
            'no-empty-pattern': 'error',
            'no-self-assign': 'error',
            'no-unreachable': 'error',
            'prefer-const': 'warn',
            'no-var': 'warn',
        },
    },

    // React hooks rules (React files only)
    {
        files: ['**/*.tsx', '**/react/**/*.ts'],
        plugins: {
            'react-hooks': reactHooks,
        },
        rules: {
            'react-hooks/rules-of-hooks': 'error',
            'react-hooks/exhaustive-deps': 'warn',
        },
    },

    // Relaxed rules for test files
    {
        files: ['**/*.spec.ts', '**/*.spec.tsx', '**/*.test.ts', '**/*.test.tsx', '**/__testUtils__/**'],
        rules: {
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-unused-vars': 'off',
        },
    },
);
