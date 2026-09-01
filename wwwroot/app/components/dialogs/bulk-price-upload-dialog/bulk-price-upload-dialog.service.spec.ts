/** @jest-environment jest-environment-jsdom */
/**
 * Tests for BulkPriceUploadDialogService
 *
 * Covers lazy loading of React bundle, dialog opening with toast wrapper,
 * boolean return value, and error handling including missing window global.
 */

jest.mock('angular', () => ({ default: { module: jest.fn(() => ({})) }, __esModule: true }));

import BulkPriceUploadDialogService from './bulk-price-upload-dialog.service';

// ---------------------------------------------------------------------------
// Shared mock factories
// ---------------------------------------------------------------------------

const createMockHttp = (manifestData: Record<string, string> = {}) => ({
    get: jest.fn().mockResolvedValue({ data: manifestData }),
});

const createMockOcLazyLoad = () => ({
    load: jest.fn().mockResolvedValue(undefined),
});

const createMockToastrService = () => ({
    showSuccessToast: jest.fn(),
    showWarningToast: jest.fn(),
    showErrorToast: jest.fn(),
});

const mockEvent = {} as MouseEvent;

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('BulkPriceUploadDialogService', () => {
    let service: BulkPriceUploadDialogService;
    let mockToastr: ReturnType<typeof createMockToastrService>;
    let mockOcLazyLoad: ReturnType<typeof createMockOcLazyLoad>;
    let mockHttp: ReturnType<typeof createMockHttp>;

    beforeEach(() => {
        mockToastr = createMockToastrService();
        mockOcLazyLoad = createMockOcLazyLoad();
        mockHttp = createMockHttp({
            'vendor-react.js': 'vendor-react.abc123.js',
            'bulkPriceUploadDialogReact.js': 'bulkPriceUploadDialogReact.bulk789.js',
        });

        service = new BulkPriceUploadDialogService(
            mockToastr as any,
            mockOcLazyLoad as any,
            mockHttp as any,
        );

        (window as any).ReactBulkPriceUploadDialog = {
            open: jest.fn().mockResolvedValue(true),
        };

        delete (window as any).React;
    });

    afterEach(() => {
        delete (window as any).ReactBulkPriceUploadDialog;
        delete (window as any).React;
    });

    // -----------------------------------------------------------------------
    // Lazy Loading
    // -----------------------------------------------------------------------

    describe('Lazy Loading', () => {
        it('should fetch manifest.json when loading for the first time', async () => {
            delete (window as any).ReactBulkPriceUploadDialog;

            mockOcLazyLoad.load.mockImplementation(async (arg: any) => {
                if (typeof arg === 'object' && arg.name) {
                    (window as any).ReactBulkPriceUploadDialog = {
                        open: jest.fn().mockResolvedValue(true),
                    };
                }
            });

            await service.openBulkPriceUploadDialog(mockEvent);

            expect(mockHttp.get).toHaveBeenCalledWith('dist/manifest.json');
        });

        it('should load vendor-react with hashed filename when React is not on window', async () => {
            delete (window as any).ReactBulkPriceUploadDialog;

            mockOcLazyLoad.load.mockImplementation(async (arg: any) => {
                if (typeof arg === 'object' && arg.name) {
                    (window as any).ReactBulkPriceUploadDialog = {
                        open: jest.fn().mockResolvedValue(true),
                    };
                }
            });

            await service.openBulkPriceUploadDialog(mockEvent);

            expect(mockOcLazyLoad.load).toHaveBeenCalledWith('dist/vendor-react.abc123.js');
        });

        it('should skip vendor-react when React is already on window', async () => {
            delete (window as any).ReactBulkPriceUploadDialog;
            (window as any).React = {};

            mockOcLazyLoad.load.mockImplementation(async () => {
                (window as any).ReactBulkPriceUploadDialog = {
                    open: jest.fn().mockResolvedValue(true),
                };
            });

            await service.openBulkPriceUploadDialog(mockEvent);

            const vendorCalls = mockOcLazyLoad.load.mock.calls.filter(
                (call: any[]) => typeof call[0] === 'string' && call[0].includes('vendor-react')
            );
            expect(vendorCalls).toHaveLength(0);
        });

        it('should load the bulkPriceUploadDialogReact module with correct name and file', async () => {
            delete (window as any).ReactBulkPriceUploadDialog;

            mockOcLazyLoad.load.mockImplementation(async (arg: any) => {
                if (typeof arg === 'object' && arg.name) {
                    (window as any).ReactBulkPriceUploadDialog = {
                        open: jest.fn().mockResolvedValue(true),
                    };
                }
            });

            await service.openBulkPriceUploadDialog(mockEvent);

            expect(mockOcLazyLoad.load).toHaveBeenCalledWith({
                name: 'uDispatch.bulkPriceUploadDialogReact',
                files: ['dist/bulkPriceUploadDialogReact.bulk789.js'],
            });
        });

        /*
         * The dialog's dropzone carries a CSS module, and the emitted stylesheet is
         * only fetched if this loader lists it — a missing one fails silently and
         * the dropzone renders with no border or hover at all. routes.ts pairs
         * script and stylesheet through islandFiles(); so must this.
         */
        it('loads the island stylesheet alongside the script when the manifest has one', async () => {
            delete (window as any).ReactBulkPriceUploadDialog;
            mockHttp.get.mockResolvedValue({
                data: {
                    'vendor-react.js': 'vendor-react.abc.js',
                    'bulkPriceUploadDialogReact.js': 'bulkPriceUploadDialogReact.bulk789.js',
                    'bulkPriceUploadDialogReact.css': 'bulkPriceUploadDialogReact.css123.css',
                },
            });
            mockOcLazyLoad.load.mockImplementation(async (arg: any) => {
                if (typeof arg === 'object' && arg.name) {
                    (window as any).ReactBulkPriceUploadDialog = {
                        open: jest.fn().mockResolvedValue(true),
                    };
                }
            });

            await service.openBulkPriceUploadDialog(mockEvent);

            expect(mockOcLazyLoad.load).toHaveBeenCalledWith({
                name: 'uDispatch.bulkPriceUploadDialogReact',
                files: [
                    'dist/bulkPriceUploadDialogReact.bulk789.js',
                    'dist/bulkPriceUploadDialogReact.css123.css',
                ],
            });
        });

        it('should fall back to unhashed filename when manifest entry is missing', async () => {
            delete (window as any).ReactBulkPriceUploadDialog;
            mockHttp.get.mockResolvedValue({ data: {} });

            mockOcLazyLoad.load.mockImplementation(async (arg: any) => {
                if (typeof arg === 'object' && arg.name) {
                    (window as any).ReactBulkPriceUploadDialog = {
                        open: jest.fn().mockResolvedValue(true),
                    };
                }
            });

            await service.openBulkPriceUploadDialog(mockEvent);

            expect(mockOcLazyLoad.load).toHaveBeenCalledWith('dist/vendor-react.js');
            expect(mockOcLazyLoad.load).toHaveBeenCalledWith({
                name: 'uDispatch.bulkPriceUploadDialogReact',
                files: ['dist/bulkPriceUploadDialogReact.js'],
            });
        });

        it('should skip loading when ReactBulkPriceUploadDialog is already on window', async () => {
            await service.openBulkPriceUploadDialog(mockEvent);

            expect(mockHttp.get).not.toHaveBeenCalled();
            expect(mockOcLazyLoad.load).not.toHaveBeenCalled();
        });

        it('should not reload on subsequent calls (caching)', async () => {
            await service.openBulkPriceUploadDialog(mockEvent);
            await service.openBulkPriceUploadDialog(mockEvent);

            expect(mockHttp.get).not.toHaveBeenCalled();
            expect(mockOcLazyLoad.load).not.toHaveBeenCalled();
        });
    });

    // -----------------------------------------------------------------------
    // Dialog Opening
    // -----------------------------------------------------------------------

    describe('Dialog Opening', () => {
        it('should call ReactBulkPriceUploadDialog.open with toastService option', async () => {
            await service.openBulkPriceUploadDialog(mockEvent);

            expect((window as any).ReactBulkPriceUploadDialog.open).toHaveBeenCalledWith({
                toastService: expect.any(Object),
            });
        });

        it('should return true when the dialog resolves with true', async () => {
            (window as any).ReactBulkPriceUploadDialog.open.mockResolvedValue(true);

            const result = await service.openBulkPriceUploadDialog(mockEvent);

            expect(result).toBe(true);
        });

        it('should return false when the dialog resolves with false', async () => {
            (window as any).ReactBulkPriceUploadDialog.open.mockResolvedValue(false);

            const result = await service.openBulkPriceUploadDialog(mockEvent);

            expect(result).toBe(false);
        });
    });

    // -----------------------------------------------------------------------
    // Toast Wrapper
    // -----------------------------------------------------------------------

    describe('Toast Wrapper', () => {
        let capturedToastService: any;

        beforeEach(async () => {
            (window as any).ReactBulkPriceUploadDialog.open.mockImplementation(
                (options: any) => {
                    capturedToastService = options.toastService;
                    return Promise.resolve(true);
                }
            );
            await service.openBulkPriceUploadDialog(mockEvent);
        });

        it('should delegate success toast to toastrService.showSuccessToast', () => {
            capturedToastService.showToast('Upload complete', 'success');

            expect(mockToastr.showSuccessToast).toHaveBeenCalledWith('Upload complete');
        });

        it('should delegate warning toast to toastrService.showWarningToast', () => {
            capturedToastService.showToast('Some rows skipped', 'warning');

            expect(mockToastr.showWarningToast).toHaveBeenCalledWith('Some rows skipped');
        });

        it('should delegate error toast to toastrService.showErrorToast', () => {
            capturedToastService.showToast('Upload failed', 'error');

            expect(mockToastr.showErrorToast).toHaveBeenCalledWith('Upload failed');
        });

        it('should not call any toast method for an unrecognized type', () => {
            capturedToastService.showToast('Info note', 'info');

            expect(mockToastr.showSuccessToast).not.toHaveBeenCalled();
            expect(mockToastr.showWarningToast).not.toHaveBeenCalled();
            expect(mockToastr.showErrorToast).not.toHaveBeenCalled();
        });
    });

    // -----------------------------------------------------------------------
    // Error Handling
    // -----------------------------------------------------------------------

    describe('Error Handling', () => {
        it('should throw when window global is missing after lazy load', async () => {
            delete (window as any).ReactBulkPriceUploadDialog;
            mockOcLazyLoad.load.mockResolvedValue(undefined);

            await expect(service.openBulkPriceUploadDialog(mockEvent)).rejects.toThrow(
                'React bulk price upload dialog not loaded'
            );
        });

        it('should propagate errors from the React dialog', async () => {
            (window as any).ReactBulkPriceUploadDialog.open.mockRejectedValue(
                new Error('Upload error')
            );

            await expect(service.openBulkPriceUploadDialog(mockEvent)).rejects.toThrow(
                'Upload error'
            );
        });

        it('should throw when manifest fetch fails', async () => {
            delete (window as any).ReactBulkPriceUploadDialog;
            mockHttp.get.mockRejectedValue(new Error('Network error'));

            await expect(service.openBulkPriceUploadDialog(mockEvent)).rejects.toThrow(
                'Network error'
            );
        });

        it('should throw when ocLazyLoad.load fails', async () => {
            delete (window as any).ReactBulkPriceUploadDialog;
            mockOcLazyLoad.load.mockRejectedValue(new Error('Script load failed'));

            await expect(service.openBulkPriceUploadDialog(mockEvent)).rejects.toThrow(
                'Script load failed'
            );
        });

        it('should propagate rejection when user cancels dialog', async () => {
            (window as any).ReactBulkPriceUploadDialog.open.mockRejectedValue(undefined);

            await expect(service.openBulkPriceUploadDialog(mockEvent)).rejects.toBeUndefined();
        });
    });

    // -----------------------------------------------------------------------
    // Misc
    // -----------------------------------------------------------------------

    describe('Service structure', () => {
        it('should have correct $inject dependencies', () => {
            expect(BulkPriceUploadDialogService.$inject).toEqual([
                'toastrService',
                '$ocLazyLoad',
                '$http',
            ]);
        });

        it('should return itself from $get()', () => {
            expect((service as any).$get()).toBe(service);
        });
    });
});
