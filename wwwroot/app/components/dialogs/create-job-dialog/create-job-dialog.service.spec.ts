/** @jest-environment jest-environment-jsdom */
/**
 * Tests for CreateJobDialogService
 *
 * Covers lazy loading of React bundle, dialog opening with correct parameters,
 * toast wrapper delegation, and error handling paths.
 */

jest.mock('angular', () => ({ default: { module: jest.fn(() => ({})) }, __esModule: true }));

import CreateJobDialogService from './create-job-dialog.service';

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

const createMockAppConfig = (isUs: boolean = false) => ({
    US_Customer: isUs,
    US_Coordinates_Center: { lat: 0, lng: 0 },
    NZ_Coordinates_Center: { lat: 0, lng: 0 },
});

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('CreateJobDialogService', () => {
    let service: CreateJobDialogService;
    let mockToastr: ReturnType<typeof createMockToastrService>;
    let mockOcLazyLoad: ReturnType<typeof createMockOcLazyLoad>;
    let mockHttp: ReturnType<typeof createMockHttp>;
    let mockAppConfig: ReturnType<typeof createMockAppConfig>;

    beforeEach(() => {
        mockToastr = createMockToastrService();
        mockOcLazyLoad = createMockOcLazyLoad();
        mockHttp = createMockHttp({
            'vendor-react.js': 'vendor-react.abc123.js',
            'createJobDialogReact.js': 'createJobDialogReact.def456.js',
        });
        mockAppConfig = createMockAppConfig(false);

        service = new CreateJobDialogService(
            mockToastr as any,
            mockOcLazyLoad as any,
            mockHttp as any,
            mockAppConfig as any,
        );

        // Set up the window global mock
        (window as any).ReactCreateJobDialog = {
            open: jest.fn().mockResolvedValue(42),
        };

        // Ensure vendor-react is not already loaded
        delete (window as any).React;
    });

    afterEach(() => {
        delete (window as any).ReactCreateJobDialog;
        delete (window as any).React;
    });

    // -----------------------------------------------------------------------
    // Lazy Loading
    // -----------------------------------------------------------------------

    describe('Lazy Loading', () => {
        it('should fetch manifest.json when loading for the first time', async () => {
            delete (window as any).ReactCreateJobDialog;

            // Re-assign after first call sets it up
            mockOcLazyLoad.load.mockImplementation(async () => {
                (window as any).ReactCreateJobDialog = { open: jest.fn().mockResolvedValue(null) };
            });

            await service.showCreateJobDialog();

            expect(mockHttp.get).toHaveBeenCalledWith('dist/manifest.json');
        });

        it('should load vendor-react with hashed filename from manifest when React is not on window', async () => {
            delete (window as any).ReactCreateJobDialog;

            mockOcLazyLoad.load.mockImplementation(async (arg: any) => {
                if (typeof arg === 'object' && arg.name) {
                    (window as any).ReactCreateJobDialog = { open: jest.fn().mockResolvedValue(null) };
                }
            });

            await service.showCreateJobDialog();

            expect(mockOcLazyLoad.load).toHaveBeenCalledWith('dist/vendor-react.abc123.js');
        });

        it('should skip vendor-react loading when React is already on window', async () => {
            delete (window as any).ReactCreateJobDialog;
            (window as any).React = {}; // already loaded

            mockOcLazyLoad.load.mockImplementation(async () => {
                (window as any).ReactCreateJobDialog = { open: jest.fn().mockResolvedValue(null) };
            });

            await service.showCreateJobDialog();

            // Should NOT have loaded vendor-react
            const vendorCalls = mockOcLazyLoad.load.mock.calls.filter(
                (call: any[]) => typeof call[0] === 'string' && call[0].includes('vendor-react')
            );
            expect(vendorCalls).toHaveLength(0);
        });

        it('should load the createJobDialogReact module with correct name and hashed file', async () => {
            delete (window as any).ReactCreateJobDialog;

            mockOcLazyLoad.load.mockImplementation(async (arg: any) => {
                if (typeof arg === 'object' && arg.name) {
                    (window as any).ReactCreateJobDialog = { open: jest.fn().mockResolvedValue(null) };
                }
            });

            await service.showCreateJobDialog();

            expect(mockOcLazyLoad.load).toHaveBeenCalledWith({
                name: 'uDispatch.createJobDialogReact',
                files: ['dist/createJobDialogReact.def456.js'],
            });
        });

        it('should fall back to unhashed filename when manifest entry is missing', async () => {
            delete (window as any).ReactCreateJobDialog;
            mockHttp.get.mockResolvedValue({ data: {} }); // empty manifest

            mockOcLazyLoad.load.mockImplementation(async (arg: any) => {
                if (typeof arg === 'object' && arg.name) {
                    (window as any).ReactCreateJobDialog = { open: jest.fn().mockResolvedValue(null) };
                }
            });

            await service.showCreateJobDialog();

            expect(mockOcLazyLoad.load).toHaveBeenCalledWith('dist/vendor-react.js');
            expect(mockOcLazyLoad.load).toHaveBeenCalledWith({
                name: 'uDispatch.createJobDialogReact',
                files: ['dist/createJobDialogReact.js'],
            });
        });

        it('should skip loading entirely when ReactCreateJobDialog is already on window', async () => {
            // window.ReactCreateJobDialog is set in beforeEach
            await service.showCreateJobDialog();

            expect(mockHttp.get).not.toHaveBeenCalled();
            expect(mockOcLazyLoad.load).not.toHaveBeenCalled();
        });

        it('should cache the loaded module and not reload on second call', async () => {
            // First call — already present on window from beforeEach
            await service.showCreateJobDialog();
            await service.showCreateJobDialog();

            expect(mockHttp.get).not.toHaveBeenCalled();
            expect(mockOcLazyLoad.load).not.toHaveBeenCalled();
        });
    });

    // -----------------------------------------------------------------------
    // Dialog Opening
    // -----------------------------------------------------------------------

    describe('Dialog Opening', () => {
        it('should call ReactCreateJobDialog.open with isUsTenant=false for NZ tenant', async () => {
            await service.showCreateJobDialog();

            expect((window as any).ReactCreateJobDialog.open).toHaveBeenCalledWith(
                false,
                expect.any(Object),
            );
        });

        it('should call ReactCreateJobDialog.open with isUsTenant=true for US tenant', async () => {
            const usService = new CreateJobDialogService(
                mockToastr as any,
                mockOcLazyLoad as any,
                mockHttp as any,
                createMockAppConfig(true) as any,
            );

            await usService.showCreateJobDialog();

            expect((window as any).ReactCreateJobDialog.open).toHaveBeenCalledWith(
                true,
                expect.any(Object),
            );
        });

        it('should return the job ID from the dialog when a job is created', async () => {
            (window as any).ReactCreateJobDialog.open.mockResolvedValue(42);

            const result = await service.showCreateJobDialog();

            expect(result).toBe(42);
        });

        it('should return undefined when the dialog resolves with null (cancelled)', async () => {
            (window as any).ReactCreateJobDialog.open.mockResolvedValue(null);

            const result = await service.showCreateJobDialog();

            expect(result).toBeUndefined();
        });

        it('should return 0 when the dialog resolves with 0', async () => {
            (window as any).ReactCreateJobDialog.open.mockResolvedValue(0);

            const result = await service.showCreateJobDialog();

            expect(result).toBe(0);
        });

        it('should accept an optional $event parameter', async () => {
            const mockEvent = new MouseEvent('click');

            const result = await service.showCreateJobDialog(mockEvent);

            expect(result).toBe(42);
        });
    });

    // -----------------------------------------------------------------------
    // Toast Wrapper
    // -----------------------------------------------------------------------

    describe('Toast Wrapper', () => {
        let capturedToastService: any;

        beforeEach(async () => {
            (window as any).ReactCreateJobDialog.open.mockImplementation(
                (_isUs: boolean, toastSvc: any) => {
                    capturedToastService = toastSvc;
                    return Promise.resolve(null);
                }
            );
            await service.showCreateJobDialog();
        });

        it('should delegate success toast to toastrService.showSuccessToast', () => {
            capturedToastService.showToast('Job created', 'success');

            expect(mockToastr.showSuccessToast).toHaveBeenCalledWith('Job created');
        });

        it('should delegate warning toast to toastrService.showWarningToast', () => {
            capturedToastService.showToast('Heads up', 'warning');

            expect(mockToastr.showWarningToast).toHaveBeenCalledWith('Heads up');
        });

        it('should delegate error toast to toastrService.showErrorToast', () => {
            capturedToastService.showToast('Something failed', 'error');

            expect(mockToastr.showErrorToast).toHaveBeenCalledWith('Something failed');
        });

        it('should not call any toast method for an unrecognized type', () => {
            capturedToastService.showToast('Info message', 'info');

            expect(mockToastr.showSuccessToast).not.toHaveBeenCalled();
            expect(mockToastr.showWarningToast).not.toHaveBeenCalled();
            expect(mockToastr.showErrorToast).not.toHaveBeenCalled();
        });
    });

    // -----------------------------------------------------------------------
    // Error Handling
    // -----------------------------------------------------------------------

    describe('Error Handling', () => {
        it('should throw when lazy loading fails', async () => {
            delete (window as any).ReactCreateJobDialog;
            mockHttp.get.mockRejectedValue(new Error('Network error'));

            await expect(service.showCreateJobDialog()).rejects.toThrow('Network error');
        });

        it('should throw when window global is missing after lazy load', async () => {
            delete (window as any).ReactCreateJobDialog;

            // Load succeeds but does not populate the global
            mockOcLazyLoad.load.mockResolvedValue(undefined);

            await expect(service.showCreateJobDialog()).rejects.toThrow(
                'React create job dialog not loaded'
            );
        });

        it('should propagate errors from the React dialog', async () => {
            (window as any).ReactCreateJobDialog.open.mockRejectedValue(
                new Error('Dialog error')
            );

            await expect(service.showCreateJobDialog()).rejects.toThrow('Dialog error');
        });

        it('should throw when ocLazyLoad.load fails', async () => {
            delete (window as any).ReactCreateJobDialog;
            mockOcLazyLoad.load.mockRejectedValue(new Error('Load failed'));

            await expect(service.showCreateJobDialog()).rejects.toThrow('Load failed');
        });
    });

    // -----------------------------------------------------------------------
    // Misc
    // -----------------------------------------------------------------------

    describe('Service structure', () => {
        it('should have correct $inject dependencies', () => {
            expect(CreateJobDialogService.$inject).toEqual([
                'toastrService',
                '$ocLazyLoad',
                '$http',
                'APP_CONFIG',
            ]);
        });

        it('should return itself from $get()', () => {
            expect(service.$get()).toBe(service);
        });
    });
});
