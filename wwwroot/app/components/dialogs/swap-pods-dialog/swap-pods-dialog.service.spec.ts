/**
 * Tests for SwapPodsDialogService
 * Covers lazy loading of the React bundle, dialog opening with jobNo mapping,
 * toast service wrapper, and error handling (including user cancellation).
 */

jest.mock('angular', () => ({
    default: {module: jest.fn(() => ({}))},
    __esModule: true,
}));

import SwapPodsDialogService from './swap-pods-dialog.service';

// --- Mock factories ---

const createMockHttp = (manifestData: Record<string, string> = {}) => ({
    get: jest.fn().mockResolvedValue({data: manifestData}),
});

const createMockOcLazyLoad = () => ({
    load: jest.fn().mockResolvedValue(undefined),
});

const createMockToastrService = () => ({
    showSuccessToast: jest.fn(),
    showWarningToast: jest.fn(),
    showErrorToast: jest.fn(),
});

describe('SwapPodsDialogService', () => {
    let service: SwapPodsDialogService;
    let mockHttp: ReturnType<typeof createMockHttp>;
    let mockOcLazyLoad: ReturnType<typeof createMockOcLazyLoad>;
    let mockToastr: ReturnType<typeof createMockToastrService>;

    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation();
        jest.spyOn(console, 'error').mockImplementation();
        jest.spyOn(console, 'debug').mockImplementation();

        mockHttp = createMockHttp({
            'vendor-react.js': 'vendor-react.abc123.js',
            'swapPodsDialogReact.js': 'swapPodsDialogReact.xyz789.js',
        });
        mockOcLazyLoad = createMockOcLazyLoad();
        mockToastr = createMockToastrService();

        service = new SwapPodsDialogService(
            mockToastr as any,
            mockOcLazyLoad as any,
            mockHttp as any,
        );

        delete (window as any).React;
        delete (window as any).ReactSwapPodsDialog;
    });

    afterEach(() => {
        delete (window as any).ReactSwapPodsDialog;
        delete (window as any).React;
        jest.restoreAllMocks();
    });

    function setupWindowGlobal() {
        (window as any).ReactSwapPodsDialog = {
            open: jest.fn().mockResolvedValue(true),
        };
    }

    describe('Service structure', () => {
        it('should have $inject with the expected dependencies', () => {
            expect(SwapPodsDialogService.$inject).toEqual([
                'toastrService',
                '$ocLazyLoad',
                '$http',
            ]);
        });

        it('should implement $get returning itself', () => {
            expect(service.$get()).toBe(service);
        });
    });

    describe('Lazy Loading', () => {
        // Note: these tests do NOT set up the window global so we can verify
        // the loading steps. The service throws "not loaded" after loading
        // completes because the mock $ocLazyLoad doesn't actually set the global.
        // We catch that expected error and verify the loading calls happened.

        it('should fetch manifest.json on first dialog open', async () => {
            const job = {id: 1, jobNo: 'JOB-1', isBulkJob: false, isArchived: false};

            await service.showSwapPodsDialog(job as any).catch(() => {});

            expect(mockHttp.get).toHaveBeenCalledWith('dist/manifest.json');
        });

        it('should load vendor-react.js with hashed filename from manifest', async () => {
            const job = {id: 1, jobNo: 'JOB-1', isBulkJob: false, isArchived: false};

            await service.showSwapPodsDialog(job as any).catch(() => {});

            expect(mockOcLazyLoad.load).toHaveBeenCalledWith('dist/vendor-react.abc123.js');
        });

        it('should load the swap PODs dialog React module with hashed filename', async () => {
            const job = {id: 1, jobNo: 'JOB-1', isBulkJob: false, isArchived: false};

            await service.showSwapPodsDialog(job as any).catch(() => {});

            expect(mockOcLazyLoad.load).toHaveBeenCalledWith({
                name: 'uDispatch.swapPodsDialogReact',
                files: ['dist/swapPodsDialogReact.xyz789.js'],
            });
        });

        it('should skip vendor-react loading if window.React already exists', async () => {
            (window as any).React = {};
            const job = {id: 1, jobNo: 'JOB-1', isBulkJob: false, isArchived: false};

            await service.showSwapPodsDialog(job as any).catch(() => {});

            expect(mockOcLazyLoad.load).toHaveBeenCalledTimes(1);
            expect(mockOcLazyLoad.load).toHaveBeenCalledWith({
                name: 'uDispatch.swapPodsDialogReact',
                files: ['dist/swapPodsDialogReact.xyz789.js'],
            });
        });

        it('should skip loading entirely if ReactSwapPodsDialog is already on window', async () => {
            setupWindowGlobal();
            const job = {id: 1, jobNo: 'JOB-1', isBulkJob: false, isArchived: false};

            await service.showSwapPodsDialog(job as any);

            expect(mockHttp.get).not.toHaveBeenCalled();
            expect(mockOcLazyLoad.load).not.toHaveBeenCalled();
        });

        it('should fall back to unmangled filename when manifest does not contain the entry', async () => {
            mockHttp = createMockHttp({});
            service = new SwapPodsDialogService(
                mockToastr as any,
                mockOcLazyLoad as any,
                mockHttp as any,
            );
            const job = {id: 1, jobNo: 'JOB-1', isBulkJob: false, isArchived: false};

            await service.showSwapPodsDialog(job as any).catch(() => {});

            expect(mockOcLazyLoad.load).toHaveBeenCalledWith('dist/vendor-react.js');
            expect(mockOcLazyLoad.load).toHaveBeenCalledWith({
                name: 'uDispatch.swapPodsDialogReact',
                files: ['dist/swapPodsDialogReact.js'],
            });
        });
    });

    describe('Dialog Opening', () => {
        beforeEach(() => {
            setupWindowGlobal();
        });

        it('should pass the job number (jobNo) to the React dialog', async () => {
            const job = {id: 42, jobNo: 'JOB-42', isBulkJob: false, isArchived: false};

            await service.showSwapPodsDialog(job as any);

            expect((window as any).ReactSwapPodsDialog.open).toHaveBeenCalledWith(
                'JOB-42',
                expect.any(Object),
            );
        });

        it('should return true when the dialog resolves with true', async () => {
            (window as any).ReactSwapPodsDialog.open.mockResolvedValue(true);
            const job = {id: 1, jobNo: 'JOB-1', isBulkJob: false, isArchived: false};

            const result = await service.showSwapPodsDialog(job as any);

            expect(result).toBe(true);
        });

        it('should return null when the dialog resolves with null (cancelled)', async () => {
            (window as any).ReactSwapPodsDialog.open.mockResolvedValue(null);
            const job = {id: 1, jobNo: 'JOB-1', isBulkJob: false, isArchived: false};

            const result = await service.showSwapPodsDialog(job as any);

            expect(result).toBeNull();
        });

        it('should include a toastService wrapper in the open call', async () => {
            const job = {id: 1, jobNo: 'JOB-1', isBulkJob: false, isArchived: false};

            await service.showSwapPodsDialog(job as any);

            const callArgs = (window as any).ReactSwapPodsDialog.open.mock.calls[0];
            expect(callArgs[1]).toBeDefined();
            expect(typeof callArgs[1].showToast).toBe('function');
        });
    });

    describe('Toast Wrapper', () => {
        let toastService: {showToast: (message: string, type: 'success' | 'warning' | 'error') => void};

        beforeEach(async () => {
            setupWindowGlobal();
            const job = {id: 1, jobNo: 'JOB-1', isBulkJob: false, isArchived: false};
            await service.showSwapPodsDialog(job as any);
            const callArgs = (window as any).ReactSwapPodsDialog.open.mock.calls[0];
            toastService = callArgs[1];
        });

        it('should delegate success toast to toastrService.showSuccessToast', () => {
            toastService.showToast('PODs swapped', 'success');
            expect(mockToastr.showSuccessToast).toHaveBeenCalledWith('PODs swapped');
        });

        it('should delegate warning toast to toastrService.showWarningToast', () => {
            toastService.showToast('Check job status', 'warning');
            expect(mockToastr.showWarningToast).toHaveBeenCalledWith('Check job status');
        });

        it('should delegate error toast to toastrService.showErrorToast', () => {
            toastService.showToast('Swap failed', 'error');
            expect(mockToastr.showErrorToast).toHaveBeenCalledWith('Swap failed');
        });
    });

    describe('Error Handling', () => {
        it('should return null when the user closes the dialog (falsy rejection)', async () => {
            setupWindowGlobal();
            (window as any).ReactSwapPodsDialog.open.mockRejectedValue(undefined);
            const job = {id: 1, jobNo: 'JOB-1', isBulkJob: false, isArchived: false};

            const result = await service.showSwapPodsDialog(job as any);

            expect(result).toBeNull();
        });

        it('should return null when the rejection value is null', async () => {
            setupWindowGlobal();
            (window as any).ReactSwapPodsDialog.open.mockRejectedValue(null);
            const job = {id: 1, jobNo: 'JOB-1', isBulkJob: false, isArchived: false};

            const result = await service.showSwapPodsDialog(job as any);

            expect(result).toBeNull();
        });

        it('should rethrow when the dialog rejects with a real error', async () => {
            setupWindowGlobal();
            const dialogError = new Error('API failure');
            (window as any).ReactSwapPodsDialog.open.mockRejectedValue(dialogError);
            const job = {id: 1, jobNo: 'JOB-1', isBulkJob: false, isArchived: false};

            await expect(
                service.showSwapPodsDialog(job as any)
            ).rejects.toThrow('API failure');
        });

        it('should throw when the React bundle fails to load', async () => {
            mockHttp.get.mockRejectedValue(new Error('Network error'));
            const job = {id: 1, jobNo: 'JOB-1', isBulkJob: false, isArchived: false};

            await expect(
                service.showSwapPodsDialog(job as any)
            ).rejects.toThrow('Network error');
        });

        it('should throw when the window global is missing after load completes', async () => {
            const job = {id: 1, jobNo: 'JOB-1', isBulkJob: false, isArchived: false};

            await expect(
                service.showSwapPodsDialog(job as any)
            ).rejects.toThrow('React swap PODs dialog not loaded');
        });
    });
});
