/**
 * Tests for VoidJobConfirmationDialogService
 * Covers lazy loading of React bundle, dialog opening with parameter mapping,
 * toast service wrapper, and error handling (including user cancellation).
 */

jest.mock('angular', () => ({
    default: { module: jest.fn(() => ({})) },
    __esModule: true,
}));

jest.mock('../../../react/interfaces', () => ({}));

import VoidJobConfirmationDialogService from './void-job-confirmation-dialog.service';

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

describe('VoidJobConfirmationDialogService', () => {
    let service: VoidJobConfirmationDialogService;
    let mockHttp: ReturnType<typeof createMockHttp>;
    let mockOcLazyLoad: ReturnType<typeof createMockOcLazyLoad>;
    let mockToastr: ReturnType<typeof createMockToastrService>;

    const mockVoidResult = {
        voidReasonId: 1,
        voidReason: 'Duplicate',
        shouldVoid: true,
    };

    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation();
        jest.spyOn(console, 'error').mockImplementation();
        jest.spyOn(console, 'debug').mockImplementation();

        mockHttp = createMockHttp({
            'vendor-react.js': 'vendor-react.abc123.js',
            'voidJobConfirmationDialogReact.js': 'voidJobConfirmationDialogReact.xyz789.js',
        });
        mockOcLazyLoad = createMockOcLazyLoad();
        mockToastr = createMockToastrService();

        service = new VoidJobConfirmationDialogService(
            mockToastr as any,
            mockOcLazyLoad as any,
            mockHttp as any,
        );

        delete (window as any).React;
        delete (window as any).ReactVoidJobConfirmationDialog;
    });

    afterEach(() => {
        delete (window as any).ReactVoidJobConfirmationDialog;
        delete (window as any).React;
        jest.restoreAllMocks();
    });

    function setupWindowGlobal() {
        (window as any).ReactVoidJobConfirmationDialog = {
            open: jest.fn().mockResolvedValue(mockVoidResult),
        };
    }

    describe('Lazy Loading', () => {
        // Note: these tests do NOT set up the window global so we can verify
        // the loading steps. The service will throw "not loaded" after loading
        // completes (because the mock $ocLazyLoad doesn't actually set the global).
        // We catch that expected error and verify the loading calls happened.

        it('should fetch manifest.json on first dialog open', async () => {
            const job = { id: 1, jobNo: 'JOB-1', isBulkJob: false, isArchived: false };

            await service.showVoidConfirmationDialog(mockEvent, job as any).catch(() => {});

            expect(mockHttp.get).toHaveBeenCalledWith('dist/manifest.json');
        });

        it('should load vendor-react.js with hashed filename from manifest', async () => {
            const job = { id: 1, jobNo: 'JOB-1', isBulkJob: false, isArchived: false };

            await service.showVoidConfirmationDialog(mockEvent, job as any).catch(() => {});

            expect(mockOcLazyLoad.load).toHaveBeenCalledWith('dist/vendor-react.abc123.js');
        });

        it('should load the void job confirmation dialog React module with hashed filename', async () => {
            const job = { id: 1, jobNo: 'JOB-1', isBulkJob: false, isArchived: false };

            await service.showVoidConfirmationDialog(mockEvent, job as any).catch(() => {});

            expect(mockOcLazyLoad.load).toHaveBeenCalledWith({
                name: 'uDispatch.voidJobConfirmationDialogReact',
                files: ['dist/voidJobConfirmationDialogReact.xyz789.js'],
            });
        });

        it('should skip vendor-react loading if window.React already exists', async () => {
            (window as any).React = {};
            const job = { id: 1, jobNo: 'JOB-1', isBulkJob: false, isArchived: false };

            await service.showVoidConfirmationDialog(mockEvent, job as any).catch(() => {});

            expect(mockOcLazyLoad.load).toHaveBeenCalledTimes(1);
            expect(mockOcLazyLoad.load).toHaveBeenCalledWith({
                name: 'uDispatch.voidJobConfirmationDialogReact',
                files: ['dist/voidJobConfirmationDialogReact.xyz789.js'],
            });
        });

        it('should skip loading entirely if ReactVoidJobConfirmationDialog is already on window', async () => {
            setupWindowGlobal();
            const job = { id: 1, jobNo: 'JOB-1', isBulkJob: false, isArchived: false };

            await service.showVoidConfirmationDialog(mockEvent, job as any);

            expect(mockHttp.get).not.toHaveBeenCalled();
            expect(mockOcLazyLoad.load).not.toHaveBeenCalled();
        });

        it('should use unmangled filename when manifest does not contain entry', async () => {
            mockHttp = createMockHttp({});
            service = new VoidJobConfirmationDialogService(
                mockToastr as any,
                mockOcLazyLoad as any,
                mockHttp as any,
            );
            const job = { id: 1, jobNo: 'JOB-1', isBulkJob: false, isArchived: false };

            await service.showVoidConfirmationDialog(mockEvent, job as any).catch(() => {});

            expect(mockOcLazyLoad.load).toHaveBeenCalledWith('dist/vendor-react.js');
            expect(mockOcLazyLoad.load).toHaveBeenCalledWith({
                name: 'uDispatch.voidJobConfirmationDialogReact',
                files: ['dist/voidJobConfirmationDialogReact.js'],
            });
        });
    });

    describe('Dialog Opening', () => {
        beforeEach(() => {
            setupWindowGlobal();
        });

        it('should map job to the expected dialog format with id, jobNo, isBulkJob, isArchived', async () => {
            const job = { id: 42, jobNo: 'JOB-42', isBulkJob: true, isArchived: false };

            await service.showVoidConfirmationDialog(mockEvent, job as any);

            expect((window as any).ReactVoidJobConfirmationDialog.open).toHaveBeenCalledWith(
                { id: 42, jobNo: 'JOB-42', isBulkJob: true, isArchived: false },
                expect.any(Object),
            );
        });

        it('should pass archived job correctly', async () => {
            const job = { id: 10, jobNo: 'ARC-10', isBulkJob: false, isArchived: true };

            await service.showVoidConfirmationDialog(mockEvent, job as any);

            const callArgs = (window as any).ReactVoidJobConfirmationDialog.open.mock.calls[0];
            expect(callArgs[0]).toEqual({ id: 10, jobNo: 'ARC-10', isBulkJob: false, isArchived: true });
        });

        it('should return the result from the React dialog directly', async () => {
            const expectedResult = { voidReasonId: 5, shouldVoid: true };
            (window as any).ReactVoidJobConfirmationDialog.open.mockResolvedValue(expectedResult);

            const job = { id: 1, jobNo: 'JOB-1', isBulkJob: false, isArchived: false };
            const result = await service.showVoidConfirmationDialog(mockEvent, job as any);

            expect(result).toEqual(expectedResult);
        });

        it('should return null when dialog returns null', async () => {
            (window as any).ReactVoidJobConfirmationDialog.open.mockResolvedValue(null);

            const job = { id: 1, jobNo: 'JOB-1', isBulkJob: false, isArchived: false };
            const result = await service.showVoidConfirmationDialog(mockEvent, job as any);

            expect(result).toBeNull();
        });

        it('should include toastService wrapper in the open call', async () => {
            const job = { id: 1, jobNo: 'JOB-1', isBulkJob: false, isArchived: false };

            await service.showVoidConfirmationDialog(mockEvent, job as any);

            const callArgs = (window as any).ReactVoidJobConfirmationDialog.open.mock.calls[0];
            expect(callArgs[1]).toBeDefined();
            expect(typeof callArgs[1].showToast).toBe('function');
        });
    });

    describe('Toast Wrapper', () => {
        let toastService: { showToast: (message: string, type: 'success' | 'warning' | 'error' | 'info') => void };

        beforeEach(async () => {
            setupWindowGlobal();

            const job = { id: 1, jobNo: 'JOB-1', isBulkJob: false, isArchived: false };
            await service.showVoidConfirmationDialog(mockEvent, job as any);

            const callArgs = (window as any).ReactVoidJobConfirmationDialog.open.mock.calls[0];
            toastService = callArgs[1];
        });

        it('should delegate success toast to toastrService.showSuccessToast', () => {
            toastService.showToast('Job voided', 'success');

            expect(mockToastr.showSuccessToast).toHaveBeenCalledWith('Job voided');
        });

        it('should delegate warning toast to toastrService.showWarningToast', () => {
            toastService.showToast('Check job status', 'warning');

            expect(mockToastr.showWarningToast).toHaveBeenCalledWith('Check job status');
        });

        it('should delegate error toast to toastrService.showErrorToast', () => {
            toastService.showToast('Void failed', 'error');

            expect(mockToastr.showErrorToast).toHaveBeenCalledWith('Void failed');
        });
    });

    describe('Error Handling', () => {
        it('should return null when user closes dialog (falsy error)', async () => {
            setupWindowGlobal();
            (window as any).ReactVoidJobConfirmationDialog.open.mockRejectedValue(undefined);

            const job = { id: 1, jobNo: 'JOB-1', isBulkJob: false, isArchived: false };
            const result = await service.showVoidConfirmationDialog(mockEvent, job as any);

            expect(result).toBeNull();
        });

        it('should return null when error is null (falsy)', async () => {
            setupWindowGlobal();
            (window as any).ReactVoidJobConfirmationDialog.open.mockRejectedValue(null);

            const job = { id: 1, jobNo: 'JOB-1', isBulkJob: false, isArchived: false };
            const result = await service.showVoidConfirmationDialog(mockEvent, job as any);

            expect(result).toBeNull();
        });

        it('should return null when error is empty string (falsy)', async () => {
            setupWindowGlobal();
            (window as any).ReactVoidJobConfirmationDialog.open.mockRejectedValue('');

            const job = { id: 1, jobNo: 'JOB-1', isBulkJob: false, isArchived: false };
            const result = await service.showVoidConfirmationDialog(mockEvent, job as any);

            expect(result).toBeNull();
        });

        it('should rethrow when dialog rejects with a real error', async () => {
            setupWindowGlobal();
            const dialogError = new Error('API failure');
            (window as any).ReactVoidJobConfirmationDialog.open.mockRejectedValue(dialogError);

            const job = { id: 1, jobNo: 'JOB-1', isBulkJob: false, isArchived: false };

            await expect(
                service.showVoidConfirmationDialog(mockEvent, job as any)
            ).rejects.toThrow('API failure');
        });

        it('should throw when React dialog load fails', async () => {
            mockHttp.get.mockRejectedValue(new Error('Network error'));

            const job = { id: 1, jobNo: 'JOB-1', isBulkJob: false, isArchived: false };

            await expect(
                service.showVoidConfirmationDialog(mockEvent, job as any)
            ).rejects.toThrow('Network error');
        });

        it('should throw when window global is missing after load', async () => {
            // load succeeds but doesn't set the window global
            const job = { id: 1, jobNo: 'JOB-1', isBulkJob: false, isArchived: false };

            await expect(
                service.showVoidConfirmationDialog(mockEvent, job as any)
            ).rejects.toThrow('React void job confirmation dialog not loaded');
        });
    });
});
