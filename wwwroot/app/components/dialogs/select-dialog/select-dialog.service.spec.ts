/** @jest-environment jest-environment-jsdom */
/**
 * Tests for SelectDialogService
 * Covers lazy loading of the React bundle, dialog opening with parameter passing,
 * return value mapping (including checkbox), cancellation, and error handling.
 */

jest.mock('angular', () => ({
    default: { module: jest.fn(() => ({})) },
    __esModule: true,
}));

import { SelectDialogService } from './select-dialog.service';

// --- Mock factories ---

const createMockHttp = (manifestData: Record<string, string> = {}) => ({
    get: jest.fn().mockResolvedValue({ data: manifestData }),
});

const createMockOcLazyLoad = () => ({
    load: jest.fn().mockResolvedValue(undefined),
});

const mockEvent = {} as MouseEvent;

const sampleItems = [
    { id: 1, text: 'Option A' },
    { id: 2, text: 'Option B' },
    { id: 3, text: 'Option C' },
];

describe('SelectDialogService', () => {
    let service: SelectDialogService;
    let mockHttp: ReturnType<typeof createMockHttp>;
    let mockOcLazyLoad: ReturnType<typeof createMockOcLazyLoad>;

    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation();
        jest.spyOn(console, 'error').mockImplementation();
        jest.spyOn(console, 'debug').mockImplementation();

        mockHttp = createMockHttp({
            'vendor-react.js': 'vendor-react.abc123.js',
            'selectDialogReact.js': 'selectDialogReact.def456.js',
        });
        mockOcLazyLoad = createMockOcLazyLoad();

        service = new SelectDialogService(
            mockOcLazyLoad as any,
            mockHttp as any,
        );

        delete (window as any).React;
        delete (window as any).ReactSelectDialog;
    });

    afterEach(() => {
        delete (window as any).ReactSelectDialog;
        delete (window as any).React;
        jest.restoreAllMocks();
    });

    function setupWindowGlobal(result: any = { fieldName: 'SpeedID', value: 2 }) {
        (window as any).ReactSelectDialog = {
            showSelectDialog: jest.fn().mockResolvedValue(result),
        };
    }

    describe('Service structure', () => {
        it('should have $inject with the expected dependencies', () => {
            expect(SelectDialogService.$inject).toEqual([
                '$ocLazyLoad',
                '$http',
            ]);
        });

        it('should implement $get returning itself', () => {
            expect(service.$get()).toBe(service);
        });
    });

    describe('Lazy Loading', () => {
        it('should fetch manifest.json on first dialog open', async () => {
            await service.showSelectDialog(
                mockEvent, sampleItems, 'SpeedID', 'Speed'
            ).catch(() => {});

            expect(mockHttp.get).toHaveBeenCalledWith('dist/manifest.json');
        });

        it('should load vendor-react.js with hashed filename from manifest', async () => {
            await service.showSelectDialog(
                mockEvent, sampleItems, 'SpeedID', 'Speed'
            ).catch(() => {});

            expect(mockOcLazyLoad.load).toHaveBeenCalledWith('dist/vendor-react.abc123.js');
        });

        it('should load the select dialog React module with hashed filename', async () => {
            await service.showSelectDialog(
                mockEvent, sampleItems, 'SpeedID', 'Speed'
            ).catch(() => {});

            expect(mockOcLazyLoad.load).toHaveBeenCalledWith({
                name: 'uDispatch.selectDialogReact',
                files: ['dist/selectDialogReact.def456.js'],
            });
        });

        it('should skip vendor-react loading if window.React already exists', async () => {
            (window as any).React = {};

            await service.showSelectDialog(
                mockEvent, sampleItems, 'SpeedID', 'Speed'
            ).catch(() => {});

            expect(mockOcLazyLoad.load).toHaveBeenCalledTimes(1);
            expect(mockOcLazyLoad.load).toHaveBeenCalledWith({
                name: 'uDispatch.selectDialogReact',
                files: ['dist/selectDialogReact.def456.js'],
            });
        });

        it('should skip loading entirely if ReactSelectDialog is already on window', async () => {
            setupWindowGlobal();

            await service.showSelectDialog(
                mockEvent, sampleItems, 'SpeedID', 'Speed'
            );

            expect(mockHttp.get).not.toHaveBeenCalled();
            expect(mockOcLazyLoad.load).not.toHaveBeenCalled();
        });

        it('should fall back to unmangled filename when manifest does not contain entry', async () => {
            mockHttp = createMockHttp({});
            service = new SelectDialogService(
                mockOcLazyLoad as any,
                mockHttp as any,
            );

            await service.showSelectDialog(
                mockEvent, sampleItems, 'SpeedID', 'Speed'
            ).catch(() => {});

            expect(mockOcLazyLoad.load).toHaveBeenCalledWith('dist/vendor-react.js');
            expect(mockOcLazyLoad.load).toHaveBeenCalledWith({
                name: 'uDispatch.selectDialogReact',
                files: ['dist/selectDialogReact.js'],
            });
        });
    });

    describe('Dialog Opening', () => {
        beforeEach(() => {
            setupWindowGlobal();
        });

        it('should call showSelectDialog with correct parameters', async () => {
            await service.showSelectDialog(
                mockEvent, sampleItems, 'SpeedID', 'Speed', 2
            );

            expect((window as any).ReactSelectDialog.showSelectDialog).toHaveBeenCalledWith({
                title: 'Speed',
                fieldName: 'SpeedID',
                items: sampleItems,
                initialValue: 2,
                showCheckbox: false,
                checkboxLabel: '',
            });
        });

        it('should pass showCheckbox and checkboxLabel when provided', async () => {
            await service.showSelectDialog(
                mockEvent, sampleItems, 'DGClass', 'DG Class', null, true, 'DG Documentation'
            );

            expect((window as any).ReactSelectDialog.showSelectDialog).toHaveBeenCalledWith({
                title: 'DG Class',
                fieldName: 'DGClass',
                items: sampleItems,
                initialValue: null,
                showCheckbox: true,
                checkboxLabel: 'DG Documentation',
            });
        });

        it('should pass null initialValue by default', async () => {
            await service.showSelectDialog(
                mockEvent, sampleItems, 'SpeedID', 'Speed'
            );

            const call = (window as any).ReactSelectDialog.showSelectDialog.mock.calls[0][0];
            expect(call.initialValue).toBeNull();
        });

        it('should pass string initialValue when provided', async () => {
            await service.showSelectDialog(
                mockEvent, sampleItems, 'Status', 'Status', 'Option A'
            );

            const call = (window as any).ReactSelectDialog.showSelectDialog.mock.calls[0][0];
            expect(call.initialValue).toBe('Option A');
        });

        it('should ignore $event parameter (kept for API compat)', async () => {
            const customEvent = { clientX: 100, clientY: 200 } as MouseEvent;

            await service.showSelectDialog(
                customEvent, sampleItems, 'SpeedID', 'Speed'
            );

            // $event is not forwarded to the React dialog
            const call = (window as any).ReactSelectDialog.showSelectDialog.mock.calls[0][0];
            expect(call).not.toHaveProperty('$event');
            expect(call).not.toHaveProperty('clientX');
        });
    });

    describe('Return Value Mapping', () => {
        it('should return mapped ISelectDialogResult on success', async () => {
            setupWindowGlobal({ fieldName: 'SpeedID', value: 2, checkboxValue: undefined });

            const result = await service.showSelectDialog(
                mockEvent, sampleItems, 'SpeedID', 'Speed', 1
            );

            expect(result).toEqual({
                fieldName: 'SpeedID',
                value: 2,
                checkboxValue: undefined,
            });
        });

        it('should include checkboxValue when present in result', async () => {
            setupWindowGlobal({ fieldName: 'DGClass', value: 3, checkboxValue: true });

            const result = await service.showSelectDialog(
                mockEvent, sampleItems, 'DGClass', 'DG Class', null, true, 'DG Documentation'
            );

            expect(result).toEqual({
                fieldName: 'DGClass',
                value: 3,
                checkboxValue: true,
            });
        });

        it('should return undefined when dialog returns null (user cancelled)', async () => {
            setupWindowGlobal(null);

            const result = await service.showSelectDialog(
                mockEvent, sampleItems, 'SpeedID', 'Speed'
            );

            expect(result).toBeUndefined();
        });
    });

    describe('Error Handling', () => {
        it('should throw when React dialog load fails (manifest fetch error)', async () => {
            mockHttp.get.mockRejectedValue(new Error('Network error'));

            await expect(
                service.showSelectDialog(mockEvent, sampleItems, 'SpeedID', 'Speed')
            ).rejects.toThrow('Network error');
        });

        it('should throw when window global is missing after load', async () => {
            await expect(
                service.showSelectDialog(mockEvent, sampleItems, 'SpeedID', 'Speed')
            ).rejects.toThrow('React select dialog not loaded');
        });

        it('should throw when ocLazyLoad fails to load module', async () => {
            mockOcLazyLoad.load.mockRejectedValue(new Error('CDN timeout'));

            await expect(
                service.showSelectDialog(mockEvent, sampleItems, 'SpeedID', 'Speed')
            ).rejects.toThrow('CDN timeout');
        });

        it('should rethrow when the React dialog rejects with a real error', async () => {
            setupWindowGlobal();
            (window as any).ReactSelectDialog.showSelectDialog.mockRejectedValue(
                new Error('Update failed')
            );

            await expect(
                service.showSelectDialog(mockEvent, sampleItems, 'SpeedID', 'Speed')
            ).rejects.toThrow('Update failed');
        });
    });
});
