import type {Config} from 'jest';

/**
 * Jest Configuration for Integration Tests
 *
 * Uses jest-fixed-jsdom for MSW 2.x compatibility.
 * This environment provides proper fetch API support required by MSW.
 */
const config: Config = {
    // Use jest-fixed-jsdom which includes fetch API polyfills for MSW 2.x
    testEnvironment: 'jest-fixed-jsdom',
    roots: ['<rootDir>/wwwroot'],

    // Only run integration tests
    testMatch: ['**/__integration__/**/*.test.ts', '**/__integration__/**/*.test.tsx'],

    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],

    transform: {
        '^.+\\.(ts|tsx)$': ['ts-jest', {
            tsconfig: 'tsconfig.test.json',
        }],
        // Transform ESM modules from MSW dependencies
        '^.+\\.m?js$': 'babel-jest',
    },

    // MSW and its dependencies use ESM - need to transform them
    transformIgnorePatterns: [
        'node_modules[\\\\/](?!(msw|@mswjs|until-async)[\\\\/])',
    ],

    moduleNameMapper: {
        '^angular$': '<rootDir>/node_modules/angular/angular.js',
        '\\.(less|css|scss|sass)$': '<rootDir>/wwwroot/app/tests/mocks/styleMock.ts',
        '\\.html$': '<rootDir>/wwwroot/app/tests/mocks/templateMock.ts',
        '^@mui/x-date-pickers/DateTimePicker$': '<rootDir>/wwwroot/app/tests/mocks/muiDatePickerMocks.ts',
        '^@mui/x-date-pickers/DatePicker$': '<rootDir>/wwwroot/app/tests/mocks/muiDatePickerMocks.ts',
        '^@mui/x-date-pickers/TimePicker$': '<rootDir>/wwwroot/app/tests/mocks/muiDatePickerMocks.ts',
        '^@mui/x-date-pickers/DateCalendar$': '<rootDir>/wwwroot/app/tests/mocks/muiDatePickerMocks.ts',
        '^@mui/x-date-pickers/TimeClock$': '<rootDir>/wwwroot/app/tests/mocks/muiDatePickerMocks.ts',
        '^@mui/x-date-pickers/LocalizationProvider$': '<rootDir>/wwwroot/app/tests/mocks/muiDatePickerMocks.ts',
        '^@mui/x-date-pickers/AdapterDayjs$': '<rootDir>/wwwroot/app/tests/mocks/muiDatePickerMocks.ts',
    },

    setupFilesAfterEnv: [
        '<rootDir>/wwwroot/app/tests/setup.ts',
        '<rootDir>/wwwroot/app/tests/setupReact.ts',
        '<rootDir>/wwwroot/app/react/__testUtils__/msw/setupIntegration.ts',
    ],

    // Performance optimizations
    maxWorkers: '50%',
    cache: true,
    cacheDirectory: '<rootDir>/.jest-cache',
    verbose: false,

    // Integration tests need longer timeouts
    testTimeout: 30000,
};

export default config;
