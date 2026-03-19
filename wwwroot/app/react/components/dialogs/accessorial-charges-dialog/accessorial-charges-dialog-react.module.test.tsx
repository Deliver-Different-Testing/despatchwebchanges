/** @jest-environment jest-environment-jsdom */
/**
 * Accessorial Charges Dialog React Module Tests
 *
 * Tests for the module's open() method which handles pre-validation
 * before opening the dialog.
 */

// Mock React DOM to prevent actual rendering
jest.mock('react-dom/client', () => ({
    createRoot: jest.fn(() => ({
        render: jest.fn(),
        unmount: jest.fn(),
    })),
}));

// Mock the theme
jest.mock('../../../theme/muiTheme', () => ({
    getTheme: jest.fn(() => ({})),
}));

// Mock ReactQueryProvider
jest.mock('../../../query', () => ({
    ReactQueryProvider: ({ children }: any) => children,
}));

// Use require() instead of import so that window.angular is set before module evaluation
let openAccessorialChargesDialog: typeof import('./accessorial-charges-dialog-react.module').openAccessorialChargesDialog;

beforeAll(() => {
    (window as any).angular = {module: jest.fn(() => ({}))};
    openAccessorialChargesDialog = require('./accessorial-charges-dialog-react.module').openAccessorialChargesDialog;
});

describe('AccessorialChargesDialogManager', () => {
    afterAll(() => {
        delete (window as any).angular;
        delete (window as any).ReactAccessorialChargesDialog;
    });

    const createMockJob = (overrides = {}) => ({
        id: 123,
        accessorialChargeGroupId: 5,
        amount: 100,
        weight: 10,
        quantity: 1,
        ...overrides,
    });

    describe('Pre-validation: Job ID and Group Check', () => {
        it('should return false when job.id is 0', async () => {
            const result = await openAccessorialChargesDialog({ job: createMockJob({ id: 0 }) });

            expect(result).toBe(false);
        });

        it('should return false when accessorialChargeGroupId is 0', async () => {
            const result = await openAccessorialChargesDialog({ job: createMockJob({ accessorialChargeGroupId: 0 }) });

            expect(result).toBe(false);
        });

        it('should return false when both id and accessorialChargeGroupId are 0', async () => {
            const result = await openAccessorialChargesDialog({ job: createMockJob({ id: 0, accessorialChargeGroupId: 0 }) });

            expect(result).toBe(false);
        });

        it('should proceed to render when both job.id and accessorialChargeGroupId are valid', async () => {
            const job = createMockJob();

            // Don't await — the promise only resolves when dialog closes
            const dialogPromise = openAccessorialChargesDialog({job});

            // Give time for synchronous initialization to complete
            await new Promise(resolve => setTimeout(resolve, 50));

            // Validation passed and rendering was attempted
            const { createRoot } = require('react-dom/client');
            expect(createRoot).toHaveBeenCalled();
        });
    });

    describe('Window Global Registration', () => {
        it('should expose ReactAccessorialChargesDialog on window', () => {
            expect((window as any).ReactAccessorialChargesDialog).toBeDefined();
        });

        it('should expose an open function on ReactAccessorialChargesDialog', () => {
            expect(typeof (window as any).ReactAccessorialChargesDialog.open).toBe('function');
        });
    });
});
