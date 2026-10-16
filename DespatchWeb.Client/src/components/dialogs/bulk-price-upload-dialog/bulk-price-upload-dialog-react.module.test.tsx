/**
 * Bulk price upload Dialog React Module Tests
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

// Mock the API service
jest.mock('../../../api/bulkPriceApi', () => ({
    bulkPriceApi: {
        applyBulkPriceUpdate: jest.fn(),
    },
}));

describe('BulkPriceUploadDialogManager', () => {
    let openBulkPriceUploadDialog: typeof import('./bulk-price-upload-dialog-react.module').openBulkPriceUploadDialog;

    beforeAll(() => {

        const module = require('./bulk-price-upload-dialog-react.module');
        openBulkPriceUploadDialog = module.openBulkPriceUploadDialog;
    });

    const createMockToastService = () => ({
        showToast: jest.fn(),
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

});
