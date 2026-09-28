/** @jest-environment jest-environment-jsdom */
/**
 * Tests for AdditionalServicesDialogService
 * Covers lazy loading of React bundle, dialog opening with parameter mapping,
 * toast service wrapper, and error handling (including user cancellation).
 */

jest.mock('angular', () => ({
    default: { module: jest.fn(() => ({})) },
    __esModule: true,
}));

import AdditionalServicesDialogService from './additional-services-dialog.service';

// --- Mock factories ---

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

describe('AdditionalServicesDialogService', () => {
    let service: AdditionalServicesDialogService;
    let mockHttp: ReturnType<typeof createMockHttp>;
    let mockOcLazyLoad: ReturnType<typeof createMockOcLazyLoad>;
    let mockToastr: ReturnType<typeof createMockToastrService>;

    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation();
        jest.spyOn(console, 'error').mockImplementation();
        jest.spyOn(console, 'debug').mockImplementation();

        mockHttp = createMockHttp({
            'vendor-react.js': 'vendor-react.abc123.js',
            'additionalServicesDialogReact.js': 'additionalServicesDialogReact.def456.js',
        });
        mockOcLazyLoad = createMockOcLazyLoad();
        mockToastr = createMockToastrService();

        service = new AdditionalServicesDialogService(
            mockToastr as any,
            mockOcLazyLoad as any,
            mockHttp as any,
        );

        // Ensure React is not on window so vendor-react loading is tested
        delete (window as any).React;
        delete (window as any).ReactAdditionalServicesDialog;
    });

    afterEach(() => {
        delete (window as any).ReactAdditionalServicesDialog;
        delete (window as any).React;
        jest.restoreAllMocks();
    });

    /**
     * Helper: sets up the window global mock so the dialog can be opened.
     * Call this in tests that need the dialog to actually open (not just test loading).
     */
    function setupWindowGlobal() {
        (window as any).ReactAdditionalServicesDialog = {
            open: jest.fn().mockResolvedValue(true),
        };
    }

    describe('Lazy Loading', () => {
        it('should fetch manifest.json on first dialog open', async () => {
            const job = { id: 1, clientId: 10, speedId: 5, items: 3, speedName: 'Express' };

            await service.showAdditionalServicesDialog(mockEvent, job as any);

            expect(mockHttp.get).toHaveBeenCalledWith('dist/manifest.json');
        });

        it('should load vendor-react.js with hashed filename from manifest', async () => {
            const job = { id: 1, clientId: 10, speedId: 5, items: 3, speedName: 'Express' };

            await service.showAdditionalServicesDialog(mockEvent, job as any);

            expect(mockOcLazyLoad.load).toHaveBeenCalledWith('dist/vendor-react.abc123.js');
        });

        it('should load the additional services dialog React module with hashed filename', async () => {
            const job = { id: 1, clientId: 10, speedId: 5, items: 3, speedName: 'Express' };

            await service.showAdditionalServicesDialog(mockEvent, job as any);

            expect(mockOcLazyLoad.load).toHaveBeenCalledWith({
                name: 'uDispatch.additionalServicesDialogReact',
                files: ['dist/additionalServicesDialogReact.def456.js'],
            });
        });

        it('should skip vendor-react loading if window.React already exists', async () => {
            (window as any).React = {};
            const job = { id: 1, clientId: 10, speedId: 5, items: 3, speedName: 'Express' };

            await service.showAdditionalServicesDialog(mockEvent, job as any);

            // Should only be called once (for the dialog module), not for vendor-react
            expect(mockOcLazyLoad.load).toHaveBeenCalledTimes(1);
            expect(mockOcLazyLoad.load).toHaveBeenCalledWith({
                name: 'uDispatch.additionalServicesDialogReact',
                files: ['dist/additionalServicesDialogReact.def456.js'],
            });
        });

        it('should skip loading entirely if ReactAdditionalServicesDialog is already on window', async () => {
            setupWindowGlobal();
            const job = { id: 1, clientId: 10, speedId: 5, items: 3, speedName: 'Express' };

            await service.showAdditionalServicesDialog(mockEvent, job as any);

            expect(mockHttp.get).not.toHaveBeenCalled();
            expect(mockOcLazyLoad.load).not.toHaveBeenCalled();
        });

        it('should use unmangled filename when manifest does not contain entry', async () => {
            mockHttp = createMockHttp({}); // empty manifest
            service = new AdditionalServicesDialogService(
                mockToastr as any,
                mockOcLazyLoad as any,
                mockHttp as any,
            );

            const job = { id: 1, clientId: 10, speedId: 5, items: 3, speedName: 'Express' };

            await service.showAdditionalServicesDialog(mockEvent, job as any);

            expect(mockOcLazyLoad.load).toHaveBeenCalledWith('dist/vendor-react.js');
            expect(mockOcLazyLoad.load).toHaveBeenCalledWith({
                name: 'uDispatch.additionalServicesDialogReact',
                files: ['dist/additionalServicesDialogReact.js'],
            });
        });
    });

    describe('Dialog Opening', () => {
        beforeEach(() => {
            setupWindowGlobal();
        });

        it('should pass correctly mapped IJob fields to React dialog', async () => {
            const job = { id: 42, clientId: 100, speedId: 3, items: 5, speedName: 'Overnight' };

            await service.showAdditionalServicesDialog(mockEvent, job as any);

            expect((window as any).ReactAdditionalServicesDialog.open).toHaveBeenCalledWith(
                expect.objectContaining({
                    job: {
                        id: 42,
                        clientId: 100,
                        speedId: 3,
                        items: 5,
                        speedName: 'Overnight',
                    },
                }),
            );
        });

        it('should map IDispatchJob fields correctly (uses speed instead of speedName, no items)', async () => {
            // IDispatchJob does not have 'items' or 'speedName', it has 'speed'
            const dispatchJob = { id: 7, clientId: 20, speedId: 2, speed: 'Standard' };

            await service.showAdditionalServicesDialog(mockEvent, dispatchJob as any);

            expect((window as any).ReactAdditionalServicesDialog.open).toHaveBeenCalledWith(
                expect.objectContaining({
                    job: {
                        id: 7,
                        clientId: 20,
                        speedId: 2,
                        items: 0,
                        speedName: 'Standard',
                    },
                }),
            );
        });

        it('should default id to 0 when job.id is null/undefined', async () => {
            const job = { id: null, clientId: 10, speedId: 1, items: 1, speedName: 'Fast' };

            await service.showAdditionalServicesDialog(mockEvent, job as any);

            const callArgs = (window as any).ReactAdditionalServicesDialog.open.mock.calls[0][0];
            expect(callArgs.job.id).toBe(0);
        });

        it('should default clientId to 0 when null/undefined', async () => {
            const job = { id: 1, clientId: null, speedId: 1, items: 1, speedName: 'Fast' };

            await service.showAdditionalServicesDialog(mockEvent, job as any);

            const callArgs = (window as any).ReactAdditionalServicesDialog.open.mock.calls[0][0];
            expect(callArgs.job.clientId).toBe(0);
        });

        it('should default speedId to 0 when null/undefined', async () => {
            const job = { id: 1, clientId: 10, speedId: null, items: 1, speedName: 'Fast' };

            await service.showAdditionalServicesDialog(mockEvent, job as any);

            const callArgs = (window as any).ReactAdditionalServicesDialog.open.mock.calls[0][0];
            expect(callArgs.job.speedId).toBe(0);
        });

        it('should default items to 0 when items property exists but is null', async () => {
            const job = { id: 1, clientId: 10, speedId: 1, items: null, speedName: 'Fast' };

            await service.showAdditionalServicesDialog(mockEvent, job as any);

            const callArgs = (window as any).ReactAdditionalServicesDialog.open.mock.calls[0][0];
            expect(callArgs.job.items).toBe(0);
        });

        it('should default speedName to empty string when speedName property exists but is null', async () => {
            const job = { id: 1, clientId: 10, speedId: 1, items: 1, speedName: null };

            await service.showAdditionalServicesDialog(mockEvent, job as any);

            const callArgs = (window as any).ReactAdditionalServicesDialog.open.mock.calls[0][0];
            expect(callArgs.job.speedName).toBe('');
        });

        it('should default speed to empty string when IDispatchJob speed is null', async () => {
            const dispatchJob = { id: 1, clientId: 10, speedId: 1, speed: null };

            await service.showAdditionalServicesDialog(mockEvent, dispatchJob as any);

            const callArgs = (window as any).ReactAdditionalServicesDialog.open.mock.calls[0][0];
            expect(callArgs.job.speedName).toBe('');
        });

        it('should include toastService in the options passed to React dialog', async () => {
            const job = { id: 1, clientId: 10, speedId: 1, items: 1, speedName: 'Fast' };

            await service.showAdditionalServicesDialog(mockEvent, job as any);

            const callArgs = (window as any).ReactAdditionalServicesDialog.open.mock.calls[0][0];
            expect(callArgs.toastService).toBeDefined();
            expect(typeof callArgs.toastService.showToast).toBe('function');
        });
    });

    describe('Toast Wrapper', () => {
        let toastService: { showToast: (message: string, type: 'success' | 'warning' | 'error' | 'info') => void };

        beforeEach(async () => {
            setupWindowGlobal();

            const job = { id: 1, clientId: 10, speedId: 1, items: 1, speedName: 'Fast' };
            await service.showAdditionalServicesDialog(mockEvent, job as any);

            const callArgs = (window as any).ReactAdditionalServicesDialog.open.mock.calls[0][0];
            toastService = callArgs.toastService;
        });

        it('should delegate success toast to toastrService.showSuccessToast', () => {
            toastService.showToast('Operation complete', 'success');

            expect(mockToastr.showSuccessToast).toHaveBeenCalledWith('Operation complete');
        });

        it('should delegate warning toast to toastrService.showWarningToast', () => {
            toastService.showToast('Be careful', 'warning');

            expect(mockToastr.showWarningToast).toHaveBeenCalledWith('Be careful');
        });

        it('should delegate error toast to toastrService.showErrorToast', () => {
            toastService.showToast('Something went wrong', 'error');

            expect(mockToastr.showErrorToast).toHaveBeenCalledWith('Something went wrong');
        });
    });

    describe('Error Handling', () => {
        it('should not throw when React dialog load fails', async () => {
            mockHttp.get.mockRejectedValue(new Error('Network error'));
            const job = { id: 1, clientId: 10, speedId: 1, items: 1, speedName: 'Fast' };

            await expect(
                service.showAdditionalServicesDialog(mockEvent, job as any)
            ).resolves.toBeUndefined();
        });

        it('should not throw when window global is missing after load', async () => {
            // loadReactDialog will succeed but will not set the window global
            const job = { id: 1, clientId: 10, speedId: 1, items: 1, speedName: 'Fast' };

            await expect(
                service.showAdditionalServicesDialog(mockEvent, job as any)
            ).resolves.toBeUndefined();
        });

        it('should silently handle user cancellation (error === undefined)', async () => {
            setupWindowGlobal();
            (window as any).ReactAdditionalServicesDialog.open.mockRejectedValue(undefined);

            const job = { id: 1, clientId: 10, speedId: 1, items: 1, speedName: 'Fast' };

            await expect(
                service.showAdditionalServicesDialog(mockEvent, job as any)
            ).resolves.toBeUndefined();
        });

        it('should log but not rethrow when dialog rejects with a real error', async () => {
            setupWindowGlobal();
            const dialogError = new Error('Dialog crashed');
            (window as any).ReactAdditionalServicesDialog.open.mockRejectedValue(dialogError);

            const job = { id: 1, clientId: 10, speedId: 1, items: 1, speedName: 'Fast' };

            await expect(
                service.showAdditionalServicesDialog(mockEvent, job as any)
            ).resolves.toBeUndefined();
        });

        it('should propagate load error to the catch block without rethrowing', async () => {
            mockOcLazyLoad.load.mockRejectedValue(new Error('Script load failed'));

            const job = { id: 1, clientId: 10, speedId: 1, items: 1, speedName: 'Fast' };

            await expect(
                service.showAdditionalServicesDialog(mockEvent, job as any)
            ).resolves.toBeUndefined();
        });
    });
});
