/**
 * Accessorial charges Dialog React Module Tests
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

// Mock ReactQueryProvider
jest.mock('../../../query', () => ({
    ReactQueryProvider: ({ children }: any) => children,
}));

// Use require() instead of import to load the module after the mocks are installed
let openAccessorialChargesDialog: typeof import('./accessorial-charges-dialog-react.module').openAccessorialChargesDialog;

beforeAll(() => {
    openAccessorialChargesDialog = require('./accessorial-charges-dialog-react.module').openAccessorialChargesDialog;
});

describe('AccessorialChargesDialogManager', () => {
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

            // Flush microtask queue for synchronous initialization
            await Promise.resolve();

            // Validation passed and rendering was attempted
            const { createRoot } = require('react-dom/client');
            expect(createRoot).toHaveBeenCalled();
        });
    });

});
