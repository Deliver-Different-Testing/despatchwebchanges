/** @jest-environment jest-environment-jsdom */
/**
 * Tests for RestoreConfirmationDialogService
 * Covers lazy loading of the React bundle, the request passed to the dialog, and error handling.
 */

jest.mock('angular', () => ({
    default: {module: jest.fn(() => ({}))},
    __esModule: true,
}));

import RestoreConfirmationDialogService from './restore-confirmation-dialog.service';

const createMockHttp = (manifestData: Record<string, string> = {}) => ({
    get: jest.fn().mockResolvedValue({data: manifestData}),
});

const createMockOcLazyLoad = () => ({
    load: jest.fn().mockResolvedValue(undefined),
});

describe('RestoreConfirmationDialogService', () => {
    let service: RestoreConfirmationDialogService;
    let mockHttp: ReturnType<typeof createMockHttp>;
    let mockOcLazyLoad: ReturnType<typeof createMockOcLazyLoad>;

    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation();
        jest.spyOn(console, 'error').mockImplementation();

        mockHttp = createMockHttp({
            'vendor-react.js': 'vendor-react.abc123.js',
            'restoreConfirmDialogReact.js': 'restoreConfirmDialogReact.xyz789.js',
        });
        mockOcLazyLoad = createMockOcLazyLoad();

        service = new RestoreConfirmationDialogService(mockOcLazyLoad as any, mockHttp as any);

        delete (window as any).React;
        delete (window as any).ReactRestoreConfirmDialog;
    });

    afterEach(() => {
        delete (window as any).ReactRestoreConfirmDialog;
        delete (window as any).React;
        jest.restoreAllMocks();
    });

    function setupWindowGlobal(result: unknown = {action: 'restore', removeCapturedImages: false}) {
        (window as any).ReactRestoreConfirmDialog = {
            open: jest.fn().mockResolvedValue(result),
        };
    }

    it('lazy-loads the React vendor and dialog bundles using the hashed manifest names', async () => {
        mockOcLazyLoad.load.mockImplementation(async () => {
            setupWindowGlobal();
        });

        await service.confirmRestore({id: 7, done: true} as any);

        expect(mockHttp.get).toHaveBeenCalledWith('dist/manifest.json');
        expect(mockOcLazyLoad.load).toHaveBeenCalledWith('dist/vendor-react.abc123.js');
        expect(mockOcLazyLoad.load).toHaveBeenCalledWith({
            name: 'uDispatch.restoreConfirmDialogReact',
            files: ['dist/restoreConfirmDialogReact.xyz789.js'],
        });
    });

    it('skips the vendor bundle when React is already on the page', async () => {
        (window as any).React = {};
        mockOcLazyLoad.load.mockImplementation(async () => {
            setupWindowGlobal();
        });

        await service.confirmRestore({id: 7} as any);

        expect(mockOcLazyLoad.load).not.toHaveBeenCalledWith('dist/vendor-react.abc123.js');
    });

    it('passes the job id and completed flag through and returns the decision', async () => {
        setupWindowGlobal({action: 'restore', removeCapturedImages: true});

        const result = await service.confirmRestore({id: 7, done: true} as any);

        expect((window as any).ReactRestoreConfirmDialog.open)
            .toHaveBeenCalledWith({jobId: 7, done: true});
        expect(result).toEqual({action: 'restore', removeCapturedImages: true});
    });

    it('returns null when the operator cancels', async () => {
        setupWindowGlobal(null);

        expect(await service.confirmRestore({id: 7} as any)).toBeNull();
    });

    it('throws when the bundle loads but never registers the global', async () => {
        await expect(service.confirmRestore({id: 7} as any))
            .rejects.toThrow('React restore confirmation dialog not loaded');
    });
});
