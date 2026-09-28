/** @jest-environment jest-environment-jsdom */
/**
 * Tests for AutoCompleteDialogService
 * Covers lazy loading of React bundle, dialog opening with search function creation,
 * parameter passing, return value mapping, and error handling.
 */

jest.mock('angular', () => ({
    default: { module: jest.fn(() => ({})) },
    __esModule: true,
}));

jest.mock('../../../services/dispatch-core.service', () => ({}));

import AutoCompleteDialogService from './auto-complete-dialog.service';

// --- Mock factories ---

const createMockHttp = (manifestData: Record<string, string> = {}) => ({
    get: jest.fn().mockResolvedValue({ data: manifestData }),
});

const createMockOcLazyLoad = () => ({
    load: jest.fn().mockResolvedValue(undefined),
});

const createMockDispatchData = () => ({
    autocompleteSearch: jest.fn().mockResolvedValue([]),
});

const mockEvent = {} as MouseEvent;

describe('AutoCompleteDialogService', () => {
    let service: AutoCompleteDialogService;
    let mockHttp: ReturnType<typeof createMockHttp>;
    let mockOcLazyLoad: ReturnType<typeof createMockOcLazyLoad>;
    let mockDispatchData: ReturnType<typeof createMockDispatchData>;

    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation();
        jest.spyOn(console, 'error').mockImplementation();
        jest.spyOn(console, 'debug').mockImplementation();

        mockHttp = createMockHttp({
            'vendor-react.js': 'vendor-react.ac1.js',
            'autoCompleteDialogReact.js': 'autoCompleteDialogReact.ac2.js',
        });
        mockOcLazyLoad = createMockOcLazyLoad();
        mockDispatchData = createMockDispatchData();

        service = new AutoCompleteDialogService(
            mockOcLazyLoad as any,
            mockHttp as any,
            mockDispatchData as any,
        );

        delete (window as any).React;
        delete (window as any).ReactAutoCompleteDialog;
    });

    afterEach(() => {
        delete (window as any).ReactAutoCompleteDialog;
        delete (window as any).React;
        jest.restoreAllMocks();
    });

    function setupWindowGlobal() {
        (window as any).ReactAutoCompleteDialog = {
            open: jest.fn().mockResolvedValue({ item: { id: 1, text: 'Result' }, shouldRerate: false }),
        };
    }

    describe('Lazy Loading', () => {
        // Note: these tests do NOT set up the window global so we can verify
        // the loading steps. The service rethrows errors, so we catch the
        // expected "not loaded" error and verify the loading calls happened.

        it('should fetch manifest.json on first dialog open', async () => {
            await service.showAutocompleteDialog(
                mockEvent, '/api/search', 'Search...', 'name', 'Find Item', undefined
            ).catch(() => {});

            expect(mockHttp.get).toHaveBeenCalledWith('dist/manifest.json');
        });

        it('should load vendor-react.js with hashed filename from manifest', async () => {
            await service.showAutocompleteDialog(
                mockEvent, '/api/search', 'Search...', 'name', 'Find Item', undefined
            ).catch(() => {});

            expect(mockOcLazyLoad.load).toHaveBeenCalledWith('dist/vendor-react.ac1.js');
        });

        it('should load the auto complete dialog React module with hashed filename', async () => {
            await service.showAutocompleteDialog(
                mockEvent, '/api/search', 'Search...', 'name', 'Find Item', undefined
            ).catch(() => {});

            expect(mockOcLazyLoad.load).toHaveBeenCalledWith({
                name: 'uDispatch.autoCompleteDialogReact',
                files: ['dist/autoCompleteDialogReact.ac2.js'],
            });
        });

        /**
         * The island's stylesheet is only fetched if the loader lists it, and a missing
         * one fails silently — the dialog just renders unstyled. This island emits the
         * largest CSS module of any dialog, so the pairing is pinned here.
         */
        it('loads the island stylesheet alongside the script when the manifest has one', async () => {
            mockHttp.get.mockResolvedValue({
                data: {
                    'vendor-react.js': 'vendor-react.v1.js',
                    'autoCompleteDialogReact.js': 'autoCompleteDialogReact.ac2.js',
                    'autoCompleteDialogReact.css': 'autoCompleteDialogReact.ac3.css',
                },
            });

            await service.showAutocompleteDialog(
                mockEvent, '/api/search', 'Search...', 'name', 'Find Item', undefined
            ).catch(() => {});

            expect(mockOcLazyLoad.load).toHaveBeenCalledWith({
                name: 'uDispatch.autoCompleteDialogReact',
                files: [
                    'dist/autoCompleteDialogReact.ac2.js',
                    'dist/autoCompleteDialogReact.ac3.css',
                ],
            });
        });

        it('should skip vendor-react loading if window.React already exists', async () => {
            (window as any).React = {};

            await service.showAutocompleteDialog(
                mockEvent, '/api/search', 'Search...', 'name', 'Find Item', undefined
            ).catch(() => {});

            expect(mockOcLazyLoad.load).toHaveBeenCalledTimes(1);
            expect(mockOcLazyLoad.load).toHaveBeenCalledWith({
                name: 'uDispatch.autoCompleteDialogReact',
                files: ['dist/autoCompleteDialogReact.ac2.js'],
            });
        });

        /**
         * The island's stylesheet is only fetched if the loader lists it, and a missing
         * one fails silently — the dialog just renders unstyled. This island emits the
         * largest CSS module of any dialog, so the pairing is pinned here.
         */
        it('loads the island stylesheet alongside the script when the manifest has one', async () => {
            mockHttp.get.mockResolvedValue({
                data: {
                    'vendor-react.js': 'vendor-react.v1.js',
                    'autoCompleteDialogReact.js': 'autoCompleteDialogReact.ac2.js',
                    'autoCompleteDialogReact.css': 'autoCompleteDialogReact.ac3.css',
                },
            });

            await service.showAutocompleteDialog(
                mockEvent, '/api/search', 'Search...', 'name', 'Find Item', undefined
            ).catch(() => {});

            expect(mockOcLazyLoad.load).toHaveBeenCalledWith({
                name: 'uDispatch.autoCompleteDialogReact',
                files: [
                    'dist/autoCompleteDialogReact.ac2.js',
                    'dist/autoCompleteDialogReact.ac3.css',
                ],
            });
        });

        it('should skip loading entirely if ReactAutoCompleteDialog is already on window', async () => {
            setupWindowGlobal();

            await service.showAutocompleteDialog(
                mockEvent, '/api/search', 'Search...', 'name', 'Find Item', undefined
            );

            expect(mockHttp.get).not.toHaveBeenCalled();
            expect(mockOcLazyLoad.load).not.toHaveBeenCalled();
        });

        it('should use unmangled filename when manifest does not contain entry', async () => {
            mockHttp = createMockHttp({});
            service = new AutoCompleteDialogService(
                mockOcLazyLoad as any,
                mockHttp as any,
                mockDispatchData as any,
            );

            await service.showAutocompleteDialog(
                mockEvent, '/api/search', 'Search...', 'name', 'Find Item', undefined
            ).catch(() => {});

            expect(mockOcLazyLoad.load).toHaveBeenCalledWith('dist/vendor-react.js');
            expect(mockOcLazyLoad.load).toHaveBeenCalledWith({
                name: 'uDispatch.autoCompleteDialogReact',
                files: ['dist/autoCompleteDialogReact.js'],
            });
        });
    });

    describe('Dialog Opening', () => {
        beforeEach(() => {
            setupWindowGlobal();
        });

        it('should call open with correct parameters including defaults', async () => {
            await service.showAutocompleteDialog(
                mockEvent, '/api/clients', 'Search clients...', 'clientName', 'Select Client', undefined
            );

            const openMock = (window as any).ReactAutoCompleteDialog.open;
            expect(openMock).toHaveBeenCalledWith(
                'Select Client',
                'Search clients...',
                expect.any(Function),
                undefined,
                false,       // showRerateOption default
                'topic',     // itemIcon default
                2,           // minInputLength default
            );
        });

        it('should pass custom showRerateOption, itemIcon, and minInputLength', async () => {
            const existingItem = { id: 5, text: 'Existing' };

            await service.showAutocompleteDialog(
                mockEvent, '/api/speeds', 'Search speeds...', 'speedName', 'Select Speed',
                existingItem as any, true, 'flight', 3
            );

            const openMock = (window as any).ReactAutoCompleteDialog.open;
            expect(openMock).toHaveBeenCalledWith(
                'Select Speed',
                'Search speeds...',
                expect.any(Function),
                existingItem,
                true,        // showRerateOption
                'flight',    // itemIcon
                3,           // minInputLength
            );
        });

        it('should pass existingItem when provided', async () => {
            const existingItem = { id: 99, text: 'Pre-selected' };

            await service.showAutocompleteDialog(
                mockEvent, '/api/items', 'Search...', 'field', 'Title', existingItem as any
            );

            const openMock = (window as any).ReactAutoCompleteDialog.open;
            expect(openMock.mock.calls[0][3]).toEqual(existingItem);
        });

        it('should create a searchFn that delegates to dispatchData.autocompleteSearch', async () => {
            const searchResults = [{ id: 1, text: 'Alpha' }, { id: 2, text: 'Beta' }];
            mockDispatchData.autocompleteSearch.mockResolvedValue(searchResults);

            await service.showAutocompleteDialog(
                mockEvent, '/api/couriers', 'Search couriers...', 'courier', 'Select Courier', undefined
            );

            // Extract the searchFn passed to the dialog
            const openMock = (window as any).ReactAutoCompleteDialog.open;
            const searchFn = openMock.mock.calls[0][2];

            const results = await searchFn('test query');

            expect(mockDispatchData.autocompleteSearch).toHaveBeenCalledWith('test query', '/api/couriers');
            expect(results).toEqual(searchResults);
        });

        it('should return result.item on success', async () => {
            const selectedItem = { id: 42, text: 'Selected Item' };
            (window as any).ReactAutoCompleteDialog.open.mockResolvedValue({
                item: selectedItem,
                shouldRerate: true,
            });

            const result = await service.showAutocompleteDialog(
                mockEvent, '/api/search', 'Search...', 'name', 'Title', undefined
            );

            expect(result).toEqual(selectedItem);
        });

        it('should return undefined when dialog returns null (user cancelled)', async () => {
            (window as any).ReactAutoCompleteDialog.open.mockResolvedValue(null);

            const result = await service.showAutocompleteDialog(
                mockEvent, '/api/search', 'Search...', 'name', 'Title', undefined
            );

            expect(result).toBeUndefined();
        });
    });

    describe('Error Handling', () => {
        it('should return undefined when user closes dialog (falsy error)', async () => {
            setupWindowGlobal();
            (window as any).ReactAutoCompleteDialog.open.mockRejectedValue(undefined);

            const result = await service.showAutocompleteDialog(
                mockEvent, '/api/search', 'Search...', 'name', 'Title', undefined
            );

            expect(result).toBeUndefined();
        });

        it('should return undefined when error is null (falsy)', async () => {
            setupWindowGlobal();
            (window as any).ReactAutoCompleteDialog.open.mockRejectedValue(null);

            const result = await service.showAutocompleteDialog(
                mockEvent, '/api/search', 'Search...', 'name', 'Title', undefined
            );

            expect(result).toBeUndefined();
        });

        it('should return undefined when error is empty string (falsy)', async () => {
            setupWindowGlobal();
            (window as any).ReactAutoCompleteDialog.open.mockRejectedValue('');

            const result = await service.showAutocompleteDialog(
                mockEvent, '/api/search', 'Search...', 'name', 'Title', undefined
            );

            expect(result).toBeUndefined();
        });

        it('should rethrow when dialog rejects with a real error', async () => {
            setupWindowGlobal();
            const dialogError = new Error('Search API crashed');
            (window as any).ReactAutoCompleteDialog.open.mockRejectedValue(dialogError);

            await expect(
                service.showAutocompleteDialog(
                    mockEvent, '/api/search', 'Search...', 'name', 'Title', undefined
                )
            ).rejects.toThrow('Search API crashed');
        });

        it('should rethrow when React dialog load fails', async () => {
            mockHttp.get.mockRejectedValue(new Error('Manifest fetch failed'));

            await expect(
                service.showAutocompleteDialog(
                    mockEvent, '/api/search', 'Search...', 'name', 'Title', undefined
                )
            ).rejects.toThrow('Manifest fetch failed');
        });

        it('should rethrow when window global is missing after load', async () => {
            await expect(
                service.showAutocompleteDialog(
                    mockEvent, '/api/search', 'Search...', 'name', 'Title', undefined
                )
            ).rejects.toThrow('React auto complete dialog not loaded');
        });

        it('should rethrow when ocLazyLoad fails to load module', async () => {
            mockOcLazyLoad.load.mockRejectedValue(new Error('CDN timeout'));

            await expect(
                service.showAutocompleteDialog(
                    mockEvent, '/api/search', 'Search...', 'name', 'Title', undefined
                )
            ).rejects.toThrow('CDN timeout');
        });
    });
});
