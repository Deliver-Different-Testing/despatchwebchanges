/** @type {import('jest').Config} */
const config = {
    clearMocks: true,
    // Default to jsdom — most React tests need it. Pure-Node tests opt out
    // with `/** @jest-environment node */` at the top of the file.
    testEnvironment: 'jest-environment-jsdom',
    roots: ['<rootDir>/src', '<rootDir>/scripts'],
    testMatch: ['**/*.spec.ts', '**/*.test.ts', '**/*.spec.tsx', '**/*.test.tsx'],
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],

    transform: {
        // `js` is for @deliver-different/glass, which ships ESM-only (its exports map has just "import").
        '^.+\\.(ts|tsx|js)$': ['@swc/jest', {
            jsc: {
                parser: { syntax: 'typescript', tsx: true, decorators: true },
                transform: { react: { runtime: 'automatic' } },
            },
        }],
    },

    transformIgnorePatterns: ['/node_modules/(?!@deliver-different/glass/)'],

    moduleNameMapper: {
        '^@deliver-different/glass$': '<rootDir>/node_modules/@deliver-different/glass/dist/index.js',
        '\\.(less|css|scss|sass)$': '<rootDir>/src/tests/mocks/styleMock.ts',
        // ESM-only packages - mock for Jest compatibility
        '^react-markdown$': '<rootDir>/src/tests/mocks/reactMarkdownMock.tsx',
        '^remark-gfm$': '<rootDir>/src/tests/mocks/remarkGfmMock.ts',
        '^react-resizable-panels$': '<rootDir>/src/tests/mocks/reactResizablePanelsMock.tsx',
    },

    setupFilesAfterEnv: [
        '<rootDir>/src/tests/setup.ts',
        // Unit-only: the integration config omits this so MSW can intercept XHR.
        '<rootDir>/src/tests/noNetwork.ts',
    ],

    collectCoverageFrom: [
        'src/**/*.ts',
        'src/**/*.tsx',
        '!src/**/*.d.ts',
        '!src/tests/**'
    ],
    coverageReporters: ['text', 'lcov', 'cobertura'],

    // Minimum coverage thresholds to prevent silent regression.
    // Tighten these as test coverage improves.
    coverageThreshold: {
        global: {
            branches: 10,
            functions: 10,
            lines: 15,
            statements: 15,
        },
    },

    testPathIgnorePatterns: ['/node_modules/', '/DespatchWeb.Tests/', '/__integration__/'],

    // Performance optimizations
    maxWorkers: '50%',
    cache: true,
    cacheDirectory: '<rootDir>/.jest-cache',
    verbose: false,

    reporters: [
        'default',
        ['jest-slow-test-reporter', { numTests: 20, warnOnSlowerThan: 300, color: true }],
    ],

    // Fail fast on hung tests (type-check CI job catches real issues).
    // 30s matches the integration config and gives MUI v9 / React 19 renders
    // enough headroom on slow CI runners without masking real hangs.
    testTimeout: 30000,

    // Use modern fake timers for better async handling
    fakeTimers: {
        enableGlobally: false,
    },
};

module.exports = config;
