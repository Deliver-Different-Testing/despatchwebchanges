import type { JestConfigWithTsJest } from 'ts-jest';

const config: JestConfigWithTsJest = {
    preset: 'ts-jest',
    testEnvironment: 'jsdom',
    roots: ['<rootDir>/wwwroot'],
    testMatch: ['**/*.spec.ts', '**/*.test.ts', '**/*.spec.tsx', '**/*.test.tsx'],
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
    transform: {
        '^.+\\.(ts|tsx)$': ['ts-jest', {
            tsconfig: {
                target: 'es6',
                module: 'commonjs',
                esModuleInterop: true,
                allowSyntheticDefaultImports: true,
                strict: false, // Relaxed for tests
                skipLibCheck: true,
                moduleResolution: 'node',
                jsx: 'react-jsx',
            }
        }]
    },
    moduleNameMapper: {
        // Map AngularJS and other dependencies
        '^angular$': '<rootDir>/node_modules/angular/angular.js',
        // Mock style imports
        '\\.(less|css|scss|sass)$': '<rootDir>/wwwroot/app/tests/mocks/styleMock.ts',
        // Mock HTML template imports
        '\\.html$': '<rootDir>/wwwroot/app/tests/mocks/templateMock.ts',
    },
    setupFilesAfterEnv: [
        '<rootDir>/wwwroot/app/tests/setup.ts',
        '<rootDir>/wwwroot/app/tests/setupReact.ts'
    ],
    collectCoverageFrom: [
        'wwwroot/app/**/*.ts',
        'wwwroot/app/**/*.tsx',
        '!wwwroot/app/**/*.d.ts',
        '!wwwroot/app/tests/**'
    ],
    testPathIgnorePatterns: ['/node_modules/', '/DespatchWeb.Tests/'],
    verbose: true
};

export default config;
