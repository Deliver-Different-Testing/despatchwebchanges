/** @jest-environment jest-environment-jsdom */
/**
 * Tests for AccessorialChargesDialogService
 *
 * Covers lazy loading of React bundle, dialog opening with correct job mapping,
 * early return when no accessorialChargeGroupId, toast wrapper, and error handling
 * including user cancellation (error === undefined).
 */

jest.mock('angular', () => ({ default: { module: jest.fn(() => ({})) }, __esModule: true }));

import AccessorialChargesDialogService from './accessorial-charges-dialog.service';

// ---------------------------------------------------------------------------
// Shared mock factories
// ---------------------------------------------------------------------------

const createMockHttp = (manifestData: Record<string, string> = {}) => ({
    get: jest.fn().mockImplementation((url: string) => {
        if (url.includes('GetPortions')) {
            return Promise.resolve({ data: [] });
        }
        return Promise.resolve({ data: manifestData });
    }),
});

const createMockOcLazyLoad = () => ({
    load: jest.fn().mockResolvedValue(undefined),
});

const createMockToastrService = () => ({
    showSuccessToast: jest.fn(),
    showWarningToast: jest.fn(),
    showErrorToast: jest.fn(),
});

/** Helper to build a mock job with accessorial charge data. */
const createMockJob = (overrides: Record<string, any> = {}) => ({
    id: 123,
    accessorialChargeGroupId: 456,
    amount: 100.50,
    weight: 25.0,
    quantity: 3,
    ...overrides,
});

const mockEvent = {} as MouseEvent;

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('AccessorialChargesDialogService', () => {
    let service: AccessorialChargesDialogService;
    let mockToastr: ReturnType<typeof createMockToastrService>;
    let mockOcLazyLoad: ReturnType<typeof createMockOcLazyLoad>;
    let mockHttp: ReturnType<typeof createMockHttp>;

    /** Makes $ocLazyLoad.load() define window.ReactAccessorialChargesDialog once the module load call resolves. */
    const setupLazyLoadToDefineDialog = () => {
        mockOcLazyLoad.load.mockImplementation(async (arg: any) => {
            if (typeof arg === 'object' && arg.name) {
                (window as any).ReactAccessorialChargesDialog = {
                    open: jest.fn().mockResolvedValue(true),
                };
            }
        });
    };

    beforeEach(() => {
        mockToastr = createMockToastrService();
        mockOcLazyLoad = createMockOcLazyLoad();
        mockHttp = createMockHttp({
            'vendor-react.js': 'vendor-react.abc123.js',
            'accessorialChargesDialogReact.js': 'accessorialChargesDialogReact.hash99.js',
        });

        service = new AccessorialChargesDialogService(
            mockToastr as any,
            mockOcLazyLoad as any,
            mockHttp as any,
        );

        (window as any).ReactAccessorialChargesDialog = {
            open: jest.fn().mockResolvedValue(true),
        };

        delete (window as any).React;
    });

    afterEach(() => {
        delete (window as any).ReactAccessorialChargesDialog;
        delete (window as any).React;
    });

    // -----------------------------------------------------------------------
    // Lazy Loading
    // -----------------------------------------------------------------------

    describe('Lazy Loading', () => {
        it('should fetch manifest.json when loading for the first time', async () => {
            delete (window as any).ReactAccessorialChargesDialog;
            setupLazyLoadToDefineDialog();

            await service.showAccessorialChargesDialog(mockEvent, createMockJob() as any);

            expect(mockHttp.get).toHaveBeenCalledWith('dist/manifest.json');
        });

        it('should load vendor-react with hashed filename when React is not on window', async () => {
            delete (window as any).ReactAccessorialChargesDialog;
            setupLazyLoadToDefineDialog();

            await service.showAccessorialChargesDialog(mockEvent, createMockJob() as any);

            expect(mockOcLazyLoad.load).toHaveBeenCalledWith('dist/vendor-react.abc123.js');
        });

        it('should skip vendor-react when React is already on window', async () => {
            delete (window as any).ReactAccessorialChargesDialog;
            (window as any).React = {};

            mockOcLazyLoad.load.mockImplementation(async () => {
                (window as any).ReactAccessorialChargesDialog = {
                    open: jest.fn().mockResolvedValue(true),
                };
            });

            await service.showAccessorialChargesDialog(mockEvent, createMockJob() as any);

            const vendorCalls = mockOcLazyLoad.load.mock.calls.filter(
                (call: any[]) => typeof call[0] === 'string' && call[0].includes('vendor-react')
            );
            expect(vendorCalls).toHaveLength(0);
        });

        it('should load the accessorialChargesDialogReact module with correct name and file', async () => {
            delete (window as any).ReactAccessorialChargesDialog;
            setupLazyLoadToDefineDialog();

            await service.showAccessorialChargesDialog(mockEvent, createMockJob() as any);

            expect(mockOcLazyLoad.load).toHaveBeenCalledWith({
                name: 'uDispatch.accessorialChargesDialogReact',
                files: ['dist/accessorialChargesDialogReact.hash99.js'],
            });
        });

        it('should fall back to unhashed filename when manifest entry is missing', async () => {
            delete (window as any).ReactAccessorialChargesDialog;
            mockHttp.get.mockResolvedValue({ data: {} });
            setupLazyLoadToDefineDialog();

            await service.showAccessorialChargesDialog(mockEvent, createMockJob() as any);

            expect(mockOcLazyLoad.load).toHaveBeenCalledWith('dist/vendor-react.js');
            expect(mockOcLazyLoad.load).toHaveBeenCalledWith({
                name: 'uDispatch.accessorialChargesDialogReact',
                files: ['dist/accessorialChargesDialogReact.js'],
            });
        });

        it('should skip loading when ReactAccessorialChargesDialog is already on window', async () => {
            await service.showAccessorialChargesDialog(mockEvent, createMockJob() as any);

            expect(mockHttp.get).not.toHaveBeenCalledWith('dist/manifest.json');
            expect(mockOcLazyLoad.load).not.toHaveBeenCalled();
        });

        it('should not reload on subsequent calls (caching)', async () => {
            await service.showAccessorialChargesDialog(mockEvent, createMockJob() as any);
            await service.showAccessorialChargesDialog(mockEvent, createMockJob() as any);

            expect(mockHttp.get).not.toHaveBeenCalledWith('dist/manifest.json');
            expect(mockOcLazyLoad.load).not.toHaveBeenCalled();
        });
    });

    // -----------------------------------------------------------------------
    // Dialog Opening
    // -----------------------------------------------------------------------

    describe('Dialog Opening', () => {
        it('should return early without loading when job has no accessorialChargeGroupId', async () => {
            const job = createMockJob({ accessorialChargeGroupId: 0 });

            await service.showAccessorialChargesDialog(mockEvent, job as any);

            expect((window as any).ReactAccessorialChargesDialog.open).not.toHaveBeenCalled();
        });

        it('should return early when accessorialChargeGroupId is null', async () => {
            const job = createMockJob({ accessorialChargeGroupId: null });

            await service.showAccessorialChargesDialog(mockEvent, job as any);

            expect((window as any).ReactAccessorialChargesDialog.open).not.toHaveBeenCalled();
        });

        it('should return early when accessorialChargeGroupId is undefined', async () => {
            const job = createMockJob({ accessorialChargeGroupId: undefined });

            await service.showAccessorialChargesDialog(mockEvent, job as any);

            expect((window as any).ReactAccessorialChargesDialog.open).not.toHaveBeenCalled();
        });

        it('should call ReactAccessorialChargesDialog.open with correctly mapped job data', async () => {
            const job = createMockJob({
                id: 789,
                accessorialChargeGroupId: 101,
                amount: 250.75,
                weight: 50.0,
                quantity: 10,
            });

            await service.showAccessorialChargesDialog(mockEvent, job as any);

            expect((window as any).ReactAccessorialChargesDialog.open).toHaveBeenCalledWith({
                job: {
                    id: 789,
                    accessorialChargeGroupId: 101,
                    amount: 250.75,
                    weight: 50.0,
                    quantity: 10,
                },
                toastService: expect.any(Object),
            });
        });

        it('should default job.id to 0 when id is null/undefined', async () => {
            const job = createMockJob({ id: null, accessorialChargeGroupId: 100 });

            await service.showAccessorialChargesDialog(mockEvent, job as any);

            expect((window as any).ReactAccessorialChargesDialog.open).toHaveBeenCalledWith(
                expect.objectContaining({
                    job: expect.objectContaining({ id: 0 }),
                })
            );
        });

        it('should pass amount, weight, and quantity from job even if undefined', async () => {
            const job = createMockJob({
                accessorialChargeGroupId: 100,
                amount: undefined,
                weight: undefined,
                quantity: undefined,
            });

            await service.showAccessorialChargesDialog(mockEvent, job as any);

            expect((window as any).ReactAccessorialChargesDialog.open).toHaveBeenCalledWith(
                expect.objectContaining({
                    job: expect.objectContaining({
                        amount: undefined,
                        weight: undefined,
                        quantity: undefined,
                    }),
                })
            );
        });

        it('should not throw when dialog resolves with true', async () => {
            (window as any).ReactAccessorialChargesDialog.open.mockResolvedValue(true);

            await expect(
                service.showAccessorialChargesDialog(mockEvent, createMockJob() as any)
            ).resolves.toBeUndefined();
        });

        it('should not throw when dialog resolves with false', async () => {
            (window as any).ReactAccessorialChargesDialog.open.mockResolvedValue(false);

            await expect(
                service.showAccessorialChargesDialog(mockEvent, createMockJob() as any)
            ).resolves.toBeUndefined();
        });
    });

    // -----------------------------------------------------------------------
    // Toast Wrapper
    // -----------------------------------------------------------------------

    describe('Toast Wrapper', () => {
        let capturedToastService: any;

        beforeEach(async () => {
            (window as any).ReactAccessorialChargesDialog.open.mockImplementation(
                (options: any) => {
                    capturedToastService = options.toastService;
                    return Promise.resolve(true);
                }
            );
            await service.showAccessorialChargesDialog(mockEvent, createMockJob() as any);
        });

        it('should delegate success toast to toastrService.showSuccessToast', () => {
            capturedToastService.showToast('Charges saved', 'success');

            expect(mockToastr.showSuccessToast).toHaveBeenCalledWith('Charges saved');
        });

        it('should delegate warning toast to toastrService.showWarningToast', () => {
            capturedToastService.showToast('Check values', 'warning');

            expect(mockToastr.showWarningToast).toHaveBeenCalledWith('Check values');
        });

        it('should delegate error toast to toastrService.showErrorToast', () => {
            capturedToastService.showToast('Save failed', 'error');

            expect(mockToastr.showErrorToast).toHaveBeenCalledWith('Save failed');
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
        it('should silently handle user cancellation (error === undefined)', async () => {
            (window as any).ReactAccessorialChargesDialog.open.mockRejectedValue(undefined);

            await expect(
                service.showAccessorialChargesDialog(mockEvent, createMockJob() as any)
            ).resolves.toBeUndefined();
        });

        it('should not rethrow when a real error occurs (logs but swallows)', async () => {
            (window as any).ReactAccessorialChargesDialog.open.mockRejectedValue(
                new Error('Server error')
            );

            await expect(
                service.showAccessorialChargesDialog(mockEvent, createMockJob() as any)
            ).resolves.toBeUndefined();
        });

        it('should not rethrow when lazy loading fails (error caught in outer try-catch)', async () => {
            delete (window as any).ReactAccessorialChargesDialog;
            mockHttp.get.mockRejectedValue(new Error('Network error'));

            await expect(
                service.showAccessorialChargesDialog(mockEvent, createMockJob() as any)
            ).resolves.toBeUndefined();
        });

        it('should throw when window global is missing after lazy load (caught by outer try-catch)', async () => {
            delete (window as any).ReactAccessorialChargesDialog;
            mockOcLazyLoad.load.mockResolvedValue(undefined);

            // The error is caught in the outer try-catch, so it doesn't propagate
            await expect(
                service.showAccessorialChargesDialog(mockEvent, createMockJob() as any)
            ).resolves.toBeUndefined();
        });
    });

    // -----------------------------------------------------------------------
    // Misc
    // -----------------------------------------------------------------------

    describe('Service structure', () => {
        it('should have correct $inject dependencies (no appConfig)', () => {
            expect(AccessorialChargesDialogService.$inject).toEqual([
                'toastrService',
                '$ocLazyLoad',
                '$http',
            ]);
        });

        it('should return itself from $get()', () => {
            expect(service.$get()).toBe(service);
        });
    });
});
