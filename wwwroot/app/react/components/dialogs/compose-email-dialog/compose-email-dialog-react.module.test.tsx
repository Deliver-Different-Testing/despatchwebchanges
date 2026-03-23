/** @jest-environment jest-environment-jsdom */
/**
 * Compose Email Dialog React Module Tests
 *
 * Tests for the module's openComposeEmailDialog() function and
 * window global registration.
 */

// Mock React DOM to prevent actual rendering
const mockRender = jest.fn();
const mockCreateRoot = jest.fn(() => ({
    render: mockRender,
    unmount: jest.fn(),
}));
jest.mock('react-dom/client', () => ({
    createRoot: mockCreateRoot,
}));

// Mock the theme
jest.mock('../../../theme/muiTheme', () => ({
    getTheme: jest.fn(() => ({})),
}));

// Mock ReactQueryProvider
jest.mock('../../../query', () => ({
    ReactQueryProvider: ({children}: any) => children,
}));

// Capture whether angular.module was called with the correct args during module load
let angularModuleRegistered = false;

// Use require() instead of import so that window.angular is set before module evaluation
let openComposeEmailDialog: typeof import('./compose-email-dialog-react.module').openComposeEmailDialog;

beforeAll(() => {
    (window as any).angular = {
        module: jest.fn((...args: unknown[]) => {
            if (args[0] === 'uDispatch.composeEmailDialogReact') {
                angularModuleRegistered = true;
            }
            return {};
        }),
    };
    openComposeEmailDialog = require('./compose-email-dialog-react.module').openComposeEmailDialog;
});

describe('ComposeEmailDialogModule', () => {
    afterAll(() => {
        delete (window as any).angular;
        delete (window as any).ReactComposeEmailDialog;
    });

    const createMockCouriers = () => [
        {courierId: 1, code: 'C01', name: 'Alice', email: 'a@test.com', phone: '111', fleet: 'Alpha'},
        {courierId: 2, code: 'C02', name: 'Bob', email: 'b@test.com', phone: '222', fleet: 'Beta'},
    ];

    describe('Window Global Registration', () => {
        it('should expose ReactComposeEmailDialog on window', () => {
            expect((window as any).ReactComposeEmailDialog).toBeDefined();
        });

        it('should expose an open function on ReactComposeEmailDialog', () => {
            expect(typeof (window as any).ReactComposeEmailDialog.open).toBe('function');
        });
    });

    describe('openComposeEmailDialog', () => {
        it('should create a React root and render when called', async () => {
            // Don't await — the promise only resolves when dialog closes, which never happens in mocks
            void openComposeEmailDialog(createMockCouriers());

            // Flush microtask queue for synchronous code
            await Promise.resolve();

            expect(mockCreateRoot).toHaveBeenCalled();
            expect(mockRender).toHaveBeenCalled();
        });

        it('should return a promise', () => {
            const result = openComposeEmailDialog(createMockCouriers());

            expect(result).toBeInstanceOf(Promise);
        });
    });

    describe('AngularJS Module Registration', () => {
        it('should register the uDispatch.composeEmailDialogReact module during load', () => {
            // angularModuleRegistered is set during require() in beforeAll,
            // independent of clearAllMocks which clears mock call history
            expect(angularModuleRegistered).toBe(true);
        });
    });
});

export {};
