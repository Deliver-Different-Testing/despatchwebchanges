/** @jest-environment jest-environment-jsdom */
/**
 * Tests for MessagingDialogService
 *
 * Covers lazy loading of React bundle, dialog opening with toast wrapper,
 * getUnreadMessageCount HTTP call, and error handling including user
 * close (error === undefined) vs real errors that are rethrown.
 */

jest.mock('angular', () => ({ default: { module: jest.fn(() => ({})) }, __esModule: true }));

import MessagingDialogService from './messaging-dialog.service';

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

const createMockLog = () => ({
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    log: jest.fn(),
});

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('MessagingDialogService', () => {
    let service: MessagingDialogService;
    let mockLog: ReturnType<typeof createMockLog>;
    let mockToastr: ReturnType<typeof createMockToastrService>;
    let mockOcLazyLoad: ReturnType<typeof createMockOcLazyLoad>;
    let mockHttp: ReturnType<typeof createMockHttp>;

    beforeEach(() => {
        mockLog = createMockLog();
        mockToastr = createMockToastrService();
        mockOcLazyLoad = createMockOcLazyLoad();
        mockHttp = createMockHttp({
            'vendor-react.js': 'vendor-react.abc123.js',
            'messagingDialogReact.js': 'messagingDialogReact.msg456.js',
        });

        service = new MessagingDialogService(
            mockLog as any,
            mockToastr as any,
            mockOcLazyLoad as any,
            mockHttp as any,
        );

        (window as any).ReactMessagingDialog = {
            open: jest.fn().mockResolvedValue(undefined),
        };

        delete (window as any).React;
    });

    afterEach(() => {
        delete (window as any).ReactMessagingDialog;
        delete (window as any).React;
    });

    // -----------------------------------------------------------------------
    // Lazy Loading
    // -----------------------------------------------------------------------

    describe('Lazy Loading', () => {
        it('should fetch manifest.json when loading for the first time', async () => {
            delete (window as any).ReactMessagingDialog;

            mockOcLazyLoad.load.mockImplementation(async (arg: any) => {
                if (typeof arg === 'object' && arg.name) {
                    (window as any).ReactMessagingDialog = {
                        open: jest.fn().mockResolvedValue(undefined),
                    };
                }
            });

            await service.openMessagingDialog();

            expect(mockHttp.get).toHaveBeenCalledWith('dist/manifest.json');
        });

        it('should load vendor-react with hashed filename when React is not on window', async () => {
            delete (window as any).ReactMessagingDialog;

            mockOcLazyLoad.load.mockImplementation(async (arg: any) => {
                if (typeof arg === 'object' && arg.name) {
                    (window as any).ReactMessagingDialog = {
                        open: jest.fn().mockResolvedValue(undefined),
                    };
                }
            });

            await service.openMessagingDialog();

            expect(mockOcLazyLoad.load).toHaveBeenCalledWith('dist/vendor-react.abc123.js');
        });

        it('should skip vendor-react when React is already on window', async () => {
            delete (window as any).ReactMessagingDialog;
            (window as any).React = {};

            mockOcLazyLoad.load.mockImplementation(async () => {
                (window as any).ReactMessagingDialog = {
                    open: jest.fn().mockResolvedValue(undefined),
                };
            });

            await service.openMessagingDialog();

            const vendorCalls = mockOcLazyLoad.load.mock.calls.filter(
                (call: any[]) => typeof call[0] === 'string' && call[0].includes('vendor-react')
            );
            expect(vendorCalls).toHaveLength(0);
        });

        it('should load the messagingDialogReact module with correct name and file', async () => {
            delete (window as any).ReactMessagingDialog;

            mockOcLazyLoad.load.mockImplementation(async (arg: any) => {
                if (typeof arg === 'object' && arg.name) {
                    (window as any).ReactMessagingDialog = {
                        open: jest.fn().mockResolvedValue(undefined),
                    };
                }
            });

            await service.openMessagingDialog();

            expect(mockOcLazyLoad.load).toHaveBeenCalledWith({
                name: 'uDispatch.messagingDialogReact',
                files: ['dist/messagingDialogReact.msg456.js'],
            });
        });

        it('should fall back to unhashed filename when manifest entry is missing', async () => {
            delete (window as any).ReactMessagingDialog;
            mockHttp.get.mockResolvedValue({ data: {} });

            mockOcLazyLoad.load.mockImplementation(async (arg: any) => {
                if (typeof arg === 'object' && arg.name) {
                    (window as any).ReactMessagingDialog = {
                        open: jest.fn().mockResolvedValue(undefined),
                    };
                }
            });

            await service.openMessagingDialog();

            expect(mockOcLazyLoad.load).toHaveBeenCalledWith('dist/vendor-react.js');
            expect(mockOcLazyLoad.load).toHaveBeenCalledWith({
                name: 'uDispatch.messagingDialogReact',
                files: ['dist/messagingDialogReact.js'],
            });
        });

        it('should skip loading when ReactMessagingDialog is already on window', async () => {
            await service.openMessagingDialog();

            expect(mockHttp.get).not.toHaveBeenCalled();
            expect(mockOcLazyLoad.load).not.toHaveBeenCalled();
        });

        it('should not reload on subsequent calls (caching)', async () => {
            await service.openMessagingDialog();
            await service.openMessagingDialog();

            expect(mockHttp.get).not.toHaveBeenCalled();
            expect(mockOcLazyLoad.load).not.toHaveBeenCalled();
        });
    });

    // -----------------------------------------------------------------------
    // Dialog Opening
    // -----------------------------------------------------------------------

    describe('Dialog Opening', () => {
        it('should call ReactMessagingDialog.open with toastService option', async () => {
            await service.openMessagingDialog();

            expect((window as any).ReactMessagingDialog.open).toHaveBeenCalledWith({
                toastService: expect.any(Object),
            });
        });

        it('should accept an optional $event parameter without affecting behavior', async () => {
            const mockEvent = new MouseEvent('click');

            await service.openMessagingDialog(mockEvent);

            expect((window as any).ReactMessagingDialog.open).toHaveBeenCalledWith({
                toastService: expect.any(Object),
            });
        });

        it('should resolve without returning a value on success', async () => {
            const result = await service.openMessagingDialog();

            expect(result).toBeUndefined();
        });
    });

    // -----------------------------------------------------------------------
    // getUnreadMessageCount
    // -----------------------------------------------------------------------

    describe('getUnreadMessageCount', () => {
        it('should call the correct endpoint', async () => {
            mockHttp.get.mockResolvedValue({ data: 5 });

            await service.getUnreadMessageCount();

            expect(mockHttp.get).toHaveBeenCalledWith('messages/GetUnreadMessageCount');
        });

        it('should return the count from response.data', async () => {
            mockHttp.get.mockResolvedValue({ data: 12 });

            const count = await service.getUnreadMessageCount();

            expect(count).toBe(12);
        });

        it('should return 0 when there are no unread messages', async () => {
            mockHttp.get.mockResolvedValue({ data: 0 });

            const count = await service.getUnreadMessageCount();

            expect(count).toBe(0);
        });

        it('should propagate errors from the HTTP call', async () => {
            mockHttp.get.mockRejectedValue(new Error('Unauthorized'));

            await expect(service.getUnreadMessageCount()).rejects.toThrow('Unauthorized');
        });
    });

    // -----------------------------------------------------------------------
    // Toast Wrapper
    // -----------------------------------------------------------------------

    describe('Toast Wrapper', () => {
        let capturedToastService: any;

        beforeEach(async () => {
            (window as any).ReactMessagingDialog.open.mockImplementation(
                (options: any) => {
                    capturedToastService = options.toastService;
                    return Promise.resolve(undefined);
                }
            );
            await service.openMessagingDialog();
        });

        it('should delegate success toast to toastrService.showSuccessToast', () => {
            capturedToastService.showToast('Message sent', 'success');

            expect(mockToastr.showSuccessToast).toHaveBeenCalledWith('Message sent');
        });

        it('should delegate warning toast to toastrService.showWarningToast', () => {
            capturedToastService.showToast('Message limit reached', 'warning');

            expect(mockToastr.showWarningToast).toHaveBeenCalledWith('Message limit reached');
        });

        it('should delegate error toast to toastrService.showErrorToast', () => {
            capturedToastService.showToast('Send failed', 'error');

            expect(mockToastr.showErrorToast).toHaveBeenCalledWith('Send failed');
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
        it('should silently return when user closes dialog (error === undefined)', async () => {
            (window as any).ReactMessagingDialog.open.mockRejectedValue(undefined);

            await expect(service.openMessagingDialog()).resolves.toBeUndefined();
        });

        it('should rethrow when a real error occurs', async () => {
            (window as any).ReactMessagingDialog.open.mockRejectedValue(
                new Error('Connection lost')
            );

            await expect(service.openMessagingDialog()).rejects.toThrow('Connection lost');
        });

        it('should rethrow when lazy loading fails', async () => {
            delete (window as any).ReactMessagingDialog;
            mockHttp.get.mockRejectedValue(new Error('Network error'));

            await expect(service.openMessagingDialog()).rejects.toThrow('Network error');
        });

        it('should throw when window global is missing after lazy load', async () => {
            delete (window as any).ReactMessagingDialog;
            mockOcLazyLoad.load.mockResolvedValue(undefined);

            await expect(service.openMessagingDialog()).rejects.toThrow(
                'React messaging dialog not loaded'
            );
        });

        it('should log error via $log.error when a real error is rethrown', async () => {
            const error = new Error('Connection lost');
            (window as any).ReactMessagingDialog.open.mockRejectedValue(error);

            await expect(service.openMessagingDialog()).rejects.toThrow();

            expect(mockLog.error).toHaveBeenCalledWith(
                'MessagingDialogService: Error in openMessagingDialog',
                error,
            );
        });

        it('should log via $log.debug when user closes dialog', async () => {
            (window as any).ReactMessagingDialog.open.mockRejectedValue(undefined);

            await service.openMessagingDialog();

            expect(mockLog.debug).toHaveBeenCalledWith('User closed messaging dialog');
        });
    });

    // -----------------------------------------------------------------------
    // Misc
    // -----------------------------------------------------------------------

    describe('Service structure', () => {
        it('should have correct $inject dependencies', () => {
            expect(MessagingDialogService.$inject).toEqual([
                '$log',
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
