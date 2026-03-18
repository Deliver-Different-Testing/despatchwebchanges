import type { Config } from 'jest';

const config: Config = {
    testEnvironment: 'jest-environment-jsdom',
    roots: ['<rootDir>/wwwroot'],
    testMatch: ['**/*.spec.ts', '**/*.test.ts', '**/*.spec.tsx', '**/*.test.tsx'],
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],

    transform: {
        '^.+\\.(ts|tsx)$': ['@swc/jest', {
            jsc: {
                parser: { syntax: 'typescript', tsx: true, decorators: true },
                transform: { react: { runtime: 'automatic' } },
            },
        }]
    },

    moduleNameMapper: {
        '^angular$': '<rootDir>/node_modules/angular/angular.js',
        '\\.(less|css|scss|sass)$': '<rootDir>/wwwroot/app/tests/mocks/styleMock.ts',
        '\\.html$': '<rootDir>/wwwroot/app/tests/mocks/templateMock.ts',
        // Mock heavy MUI date picker components for faster tests
        '^@mui/x-date-pickers/DateTimePicker$': '<rootDir>/wwwroot/app/tests/mocks/muiDatePickerMocks.ts',
        '^@mui/x-date-pickers/DatePicker$': '<rootDir>/wwwroot/app/tests/mocks/muiDatePickerMocks.ts',
        '^@mui/x-date-pickers/TimePicker$': '<rootDir>/wwwroot/app/tests/mocks/muiDatePickerMocks.ts',
        '^@mui/x-date-pickers/DateCalendar$': '<rootDir>/wwwroot/app/tests/mocks/muiDatePickerMocks.ts',
        '^@mui/x-date-pickers/TimeClock$': '<rootDir>/wwwroot/app/tests/mocks/muiDatePickerMocks.ts',
        '^@mui/x-date-pickers/LocalizationProvider$': '<rootDir>/wwwroot/app/tests/mocks/muiDatePickerMocks.ts',
        '^@mui/x-date-pickers/AdapterDayjs$': '<rootDir>/wwwroot/app/tests/mocks/muiDatePickerMocks.ts',
        // ESM-only packages - mock for Jest compatibility
        '^react-markdown$': '<rootDir>/wwwroot/app/tests/mocks/reactMarkdownMock.tsx',
        '^remark-gfm$': '<rootDir>/wwwroot/app/tests/mocks/remarkGfmMock.ts',
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

    // Reduce memory usage and improve GC
    workerIdleMemoryLimit: '512MB',

    // Fail fast on hung tests (type-check CI job catches real issues)
    testTimeout: 30000,

    // Use modern fake timers for better async handling
    fakeTimers: {
        enableGlobally: false,
    },
};

export default config;
