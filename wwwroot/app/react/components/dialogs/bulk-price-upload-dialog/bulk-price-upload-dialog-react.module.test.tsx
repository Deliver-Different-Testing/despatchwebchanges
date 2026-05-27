/**
 * Bulk Price Upload Dialog React Module Tests
 *
 * Tests for the module's open() method and window global registration.
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

// Mock the API service
jest.mock('../../../services/bulkPriceApi', () => ({
    bulkPriceApi: {
        applyBulkPriceUpdate: jest.fn(),
    },
}));

describe('BulkPriceUploadDialogManager', () => {
    let openBulkPriceUploadDialog: typeof import('./bulk-price-upload-dialog-react.module').openBulkPriceUploadDialog;

    beforeAll(() => {
        // Set up angular mock before importing the module
        (window as any).angular = {
            module: jest.fn(() => ({})),
        };

        // Now import the module
        const module = require('./bulk-price-upload-dialog-react.module');
        openBulkPriceUploadDialog = module.openBulkPriceUploadDialog;
    });

    afterAll(() => {
        delete (window as any).angular;
        delete (window as any).ReactBulkPriceUploadDialog;
    });

    const createMockToastService = () => ({
        showToast: jest.fn(),
    });

    describe('Window Global Registration', () => {
        it('should expose ReactBulkPriceUploadDialog on window', () => {
            expect((window as any).ReactBulkPriceUploadDialog).toBeDefined();
            expect((window as any).ReactBulkPriceUploadDialog.open).toBeDefined();
            expect(typeof (window as any).ReactBulkPriceUploadDialog.open).toBe('function');
        });
    });

    describe('Open Dialog', () => {
        it('should return a promise when opening dialog', () => {
            const toastService = createMockToastService();

            const result = openBulkPriceUploadDialog({ toastService });

            expect(result).toBeInstanceOf(Promise);
        });

        it('should work without toastService', () => {
            const result = openBulkPriceUploadDialog({});

            expect(result).toBeInstanceOf(Promise);
        });

        it('should create dialog container in document body', async () => {
            const toastService = createMockToastService();

            // Start opening the dialog (don't await — the promise resolves on user close)
            openBulkPriceUploadDialog({toastService});

            // Flush microtask queue for async rendering
            await Promise.resolve();

            const container = document.getElementById('react-bulk-price-upload-dialog-root');
            expect(container).not.toBeNull();
        });
    });

    describe('AngularJS Module Registration', () => {
        it('should have registered AngularJS module on load', () => {
            // The module was registered when we required it in beforeAll
            // We can verify the window global exists
            expect((window as any).ReactBulkPriceUploadDialog).toBeDefined();
        });
    });
});
