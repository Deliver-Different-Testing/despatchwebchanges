/** @jest-environment jest-environment-jsdom */
/**
 * Tests for SimplePriceEditDialogService
 * Covers lazy loading of the React bundle, dialog opening with parameter passing,
 * toast bridge delegation, return value mapping, cancellation, and error handling.
 */

jest.mock('angular', () => ({
    default: { module: jest.fn(() => ({})) },
    __esModule: true,
}));

import SimplePriceEditDialogService from './simple-price-edit-dialog.service';
import { PriceEditResult } from './simple-price-edit-dialog.service';

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

const mockJob = {
    id: 42,
    jobNo: 'JOB-100',
    charge: 150.00,
} as any;

function setupWindowGlobal(result: PriceEditResult | null = { mode: 'recalculate', amount: 175 }) {
    (window as any).ReactSimplePriceEditDialog = {
        open: jest.fn().mockResolvedValue(result),
        setToastService: jest.fn(),
    };
}

describe('SimplePriceEditDialogService', () => {
    let service: SimplePriceEditDialogService;
    let mockHttp: ReturnType<typeof createMockHttp>;
    let mockOcLazyLoad: ReturnType<typeof createMockOcLazyLoad>;
    let mockToastrService: ReturnType<typeof createMockToastrService>;

    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation();
        jest.spyOn(console, 'error').mockImplementation();

        mockHttp = createMockHttp({
            'vendor-react.js': 'vendor-react.abc123.js',
            'simplePriceEditDialogReact.js': 'simplePriceEditDialogReact.def456.js',
        });
        mockOcLazyLoad = createMockOcLazyLoad();
        mockToastrService = createMockToastrService();

        service = new SimplePriceEditDialogService(
            mockOcLazyLoad as any,
            mockHttp as any,
            mockToastrService as any,
        );

        delete (window as any).React;
        delete (window as any).ReactSimplePriceEditDialog;
    });

    afterEach(() => {
        delete (window as any).ReactSimplePriceEditDialog;
        delete (window as any).React;
        jest.restoreAllMocks();
    });

    describe('Service structure', () => {
        it('should have $inject with the expected dependencies', () => {
            expect(SimplePriceEditDialogService.$inject).toEqual([
                '$ocLazyLoad',
                '$http',
                'toastrService',
            ]);
        });

        it('should implement $get returning itself', () => {
            expect(service.$get()).toBe(service);
        });
    });

    describe('Lazy Loading', () => {
        it('should fetch manifest.json on first dialog open', async () => {
            await service.openSimplePriceEditDialog(
                mockEvent, mockJob
            ).catch(() => {});

            expect(mockHttp.get).toHaveBeenCalledWith('dist/manifest.json');
        });

        it('should load vendor-react.js with hashed filename from manifest', async () => {
            await service.openSimplePriceEditDialog(
                mockEvent, mockJob
            ).catch(() => {});

            expect(mockOcLazyLoad.load).toHaveBeenCalledWith('dist/vendor-react.abc123.js');
        });

        it('should load the simple price edit dialog React module with hashed filename', async () => {
            await service.openSimplePriceEditDialog(
                mockEvent, mockJob
            ).catch(() => {});

            expect(mockOcLazyLoad.load).toHaveBeenCalledWith({
                name: 'uDispatch.simplePriceEditDialogReact',
                files: ['dist/simplePriceEditDialogReact.def456.js'],
            });
        });

        it('should skip vendor-react loading if window.React already exists', async () => {
            (window as any).React = {};

            await service.openSimplePriceEditDialog(
                mockEvent, mockJob
            ).catch(() => {});

            expect(mockOcLazyLoad.load).toHaveBeenCalledTimes(1);
            expect(mockOcLazyLoad.load).toHaveBeenCalledWith({
                name: 'uDispatch.simplePriceEditDialogReact',
                files: ['dist/simplePriceEditDialogReact.def456.js'],
            });
        });

        it('should skip loading entirely if ReactSimplePriceEditDialog is already on window', async () => {
            setupWindowGlobal();

            await service.openSimplePriceEditDialog(
                mockEvent, mockJob
            );

            expect(mockHttp.get).not.toHaveBeenCalled();
            expect(mockOcLazyLoad.load).not.toHaveBeenCalled();
        });

        it('should fall back to unmangled filename when manifest does not contain entry', async () => {
            mockHttp = createMockHttp({});
            service = new SimplePriceEditDialogService(
                mockOcLazyLoad as any,
                mockHttp as any,
                mockToastrService as any,
            );

            await service.openSimplePriceEditDialog(
                mockEvent, mockJob
            ).catch(() => {});

            expect(mockOcLazyLoad.load).toHaveBeenCalledWith('dist/vendor-react.js');
            expect(mockOcLazyLoad.load).toHaveBeenCalledWith({
                name: 'uDispatch.simplePriceEditDialogReact',
                files: ['dist/simplePriceEditDialogReact.js'],
            });
        });
    });

    describe('Dialog Opening', () => {
        beforeEach(() => {
            setupWindowGlobal();
        });

        it('should call open with correct options', async () => {
            await service.openSimplePriceEditDialog(
                mockEvent, mockJob
            );

            expect((window as any).ReactSimplePriceEditDialog.open).toHaveBeenCalledWith({
                jobId: 42,
                jobNumber: 'JOB-100',
                currentCharge: 150.00,
                isPrebook: false,
            });
        });

        it('should pass isPrebook when provided', async () => {
            await service.openSimplePriceEditDialog(
                mockEvent, mockJob, true
            );

            expect((window as any).ReactSimplePriceEditDialog.open).toHaveBeenCalledWith({
                jobId: 42,
                jobNumber: 'JOB-100',
                currentCharge: 150.00,
                isPrebook: true,
            });
        });

        it('should ignore $event parameter (kept for API compat)', async () => {
            const customEvent = { clientX: 100, clientY: 200 } as MouseEvent;

            await service.openSimplePriceEditDialog(
                customEvent, mockJob
            );

            const call = (window as any).ReactSimplePriceEditDialog.open.mock.calls[0][0];
            expect(call).not.toHaveProperty('$event');
            expect(call).not.toHaveProperty('clientX');
        });
    });

    describe('Toast Bridge', () => {
        beforeEach(() => {
            setupWindowGlobal();
        });

        it('should call setToastService on the React dialog', async () => {
            await service.openSimplePriceEditDialog(
                mockEvent, mockJob
            );

            expect((window as any).ReactSimplePriceEditDialog.setToastService).toHaveBeenCalledWith(
                expect.objectContaining({
                    showToast: expect.any(Function),
                })
            );
        });

        it('should delegate success toast to toastrService', async () => {
            await service.openSimplePriceEditDialog(
                mockEvent, mockJob
            );

            const bridgeCall = (window as any).ReactSimplePriceEditDialog.setToastService.mock.calls[0][0];
            bridgeCall.showToast('Price saved', 'success');

            expect(mockToastrService.showSuccessToast).toHaveBeenCalledWith('Price saved');
        });

        it('should delegate warning toast to toastrService', async () => {
            await service.openSimplePriceEditDialog(
                mockEvent, mockJob
            );

            const bridgeCall = (window as any).ReactSimplePriceEditDialog.setToastService.mock.calls[0][0];
            bridgeCall.showToast('Low price warning', 'warning');

            expect(mockToastrService.showWarningToast).toHaveBeenCalledWith('Low price warning');
        });

        it('should delegate error toast to toastrService', async () => {
            await service.openSimplePriceEditDialog(
                mockEvent, mockJob
            );

            const bridgeCall = (window as any).ReactSimplePriceEditDialog.setToastService.mock.calls[0][0];
            bridgeCall.showToast('Save failed', 'error');

            expect(mockToastrService.showErrorToast).toHaveBeenCalledWith('Save failed');
        });
    });

    describe('Return Value', () => {
        it('should return PriceEditResult on success', async () => {
            setupWindowGlobal({ mode: 'base', amount: 200 });

            const result = await service.openSimplePriceEditDialog(
                mockEvent, mockJob
            );

            expect(result).toEqual({ mode: 'base', amount: 200 });
        });

        it('should throw undefined on cancel (matches $mdDialog.cancel())', async () => {
            setupWindowGlobal(null);

            try {
                await service.openSimplePriceEditDialog(
                    mockEvent, mockJob
                );
                fail('Should have thrown');
            } catch (error) {
                expect(error).toBeUndefined();
            }
        });
    });

    describe('Error Handling', () => {
        it('should throw on manifest fetch failure', async () => {
            mockHttp.get.mockRejectedValue(new Error('Network error'));

            await expect(
                service.openSimplePriceEditDialog(mockEvent, mockJob)
            ).rejects.toThrow('Network error');
        });

        it('should throw when window global is missing after load', async () => {
            await expect(
                service.openSimplePriceEditDialog(mockEvent, mockJob)
            ).rejects.toThrow('React simple price edit dialog not loaded');
        });

        it('should throw when ocLazyLoad fails to load module', async () => {
            mockOcLazyLoad.load.mockRejectedValue(new Error('CDN timeout'));

            await expect(
                service.openSimplePriceEditDialog(mockEvent, mockJob)
            ).rejects.toThrow('CDN timeout');
        });

        it('should rethrow when the React dialog rejects with a real error', async () => {
            setupWindowGlobal();
            (window as any).ReactSimplePriceEditDialog.open.mockRejectedValue(
                new Error('Update failed')
            );

            await expect(
                service.openSimplePriceEditDialog(mockEvent, mockJob)
            ).rejects.toThrow('Update failed');
        });
    });
});
