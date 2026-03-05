/**
 * Tests for FlightDetailsDialogService
 * Covers lazy loading of React bundle, dialog opening with flightData passthrough,
 * and error handling (rethrows all errors, no special cancellation handling).
 */

jest.mock('angular', () => ({
    default: { module: jest.fn(() => ({})) },
    __esModule: true,
}));

jest.mock('../../Nationwide/nationwide.interfaces', () => ({}));

import FlightDetailsDialogService from './flight-details-dialog.service';

// --- Mock factories ---

const createMockHttp = (manifestData: Record<string, string> = {}) => ({
    get: jest.fn().mockResolvedValue({ data: manifestData }),
});

const createMockOcLazyLoad = () => ({
    load: jest.fn().mockResolvedValue(undefined),
});

const mockEvent = {} as MouseEvent;

describe('FlightDetailsDialogService', () => {
    let service: FlightDetailsDialogService;
    let mockHttp: ReturnType<typeof createMockHttp>;
    let mockOcLazyLoad: ReturnType<typeof createMockOcLazyLoad>;

    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation();
        jest.spyOn(console, 'error').mockImplementation();
        jest.spyOn(console, 'debug').mockImplementation();

        mockHttp = createMockHttp({
            'vendor-react.js': 'vendor-react.v1hash.js',
            'flightDetailsDialogReact.js': 'flightDetailsDialogReact.v2hash.js',
        });
        mockOcLazyLoad = createMockOcLazyLoad();

        service = new FlightDetailsDialogService(
            mockOcLazyLoad as any,
            mockHttp as any,
        );

        delete (window as any).React;
        delete (window as any).ReactFlightDetailsDialog;
    });

    afterEach(() => {
        delete (window as any).ReactFlightDetailsDialog;
        delete (window as any).React;
        jest.restoreAllMocks();
    });

    function setupWindowGlobal() {
        (window as any).ReactFlightDetailsDialog = {
            openFlightDetailsDialog: jest.fn().mockResolvedValue(undefined),
        };
    }

    describe('Lazy Loading', () => {
        // Note: these tests do NOT set up the window global so we can verify
        // the loading steps. The service rethrows errors, so we catch the
        // expected "not loaded" error and verify the loading calls happened.

        it('should fetch manifest.json on first dialog open', async () => {
            const flightData = { flightNumber: 'NZ100', flightSegments: [] };

            await service.openFlightDetailsDialog(mockEvent, flightData as any).catch(() => {});

            expect(mockHttp.get).toHaveBeenCalledWith('dist/manifest.json');
        });

        it('should load vendor-react.js with hashed filename from manifest', async () => {
            const flightData = { flightNumber: 'NZ100', flightSegments: [] };

            await service.openFlightDetailsDialog(mockEvent, flightData as any).catch(() => {});

            expect(mockOcLazyLoad.load).toHaveBeenCalledWith('dist/vendor-react.v1hash.js');
        });

        it('should load the flight details dialog React module with hashed filename', async () => {
            const flightData = { flightNumber: 'NZ100', flightSegments: [] };

            await service.openFlightDetailsDialog(mockEvent, flightData as any).catch(() => {});

            expect(mockOcLazyLoad.load).toHaveBeenCalledWith({
                name: 'uDispatch.flightDetailsDialogReact',
                files: ['dist/flightDetailsDialogReact.v2hash.js'],
            });
        });

        it('should skip vendor-react loading if window.React already exists', async () => {
            (window as any).React = {};
            const flightData = { flightNumber: 'NZ100', flightSegments: [] };

            await service.openFlightDetailsDialog(mockEvent, flightData as any).catch(() => {});

            expect(mockOcLazyLoad.load).toHaveBeenCalledTimes(1);
            expect(mockOcLazyLoad.load).toHaveBeenCalledWith({
                name: 'uDispatch.flightDetailsDialogReact',
                files: ['dist/flightDetailsDialogReact.v2hash.js'],
            });
        });

        it('should skip loading entirely if ReactFlightDetailsDialog is already on window', async () => {
            setupWindowGlobal();
            const flightData = { flightNumber: 'NZ100', flightSegments: [] };

            await service.openFlightDetailsDialog(mockEvent, flightData as any);

            expect(mockHttp.get).not.toHaveBeenCalled();
            expect(mockOcLazyLoad.load).not.toHaveBeenCalled();
        });

        it('should use unmangled filename when manifest does not contain entry', async () => {
            mockHttp = createMockHttp({});
            service = new FlightDetailsDialogService(
                mockOcLazyLoad as any,
                mockHttp as any,
            );
            const flightData = { flightNumber: 'NZ100', flightSegments: [] };

            await service.openFlightDetailsDialog(mockEvent, flightData as any).catch(() => {});

            expect(mockOcLazyLoad.load).toHaveBeenCalledWith('dist/vendor-react.js');
            expect(mockOcLazyLoad.load).toHaveBeenCalledWith({
                name: 'uDispatch.flightDetailsDialogReact',
                files: ['dist/flightDetailsDialogReact.js'],
            });
        });
    });

    describe('Dialog Opening', () => {
        beforeEach(() => {
            setupWindowGlobal();
        });

        it('should pass flightData directly to the React dialog', async () => {
            const flightData = {
                flightNumber: 'NZ456',
                departureTime: '2025-06-15T08:30:00',
                arrivalTime: '2025-06-15T12:00:00',
                flightSegments: [
                    {
                        segmentOrder: 1,
                        departureAirportFsCode: 'AKL',
                        arrivalAirportFsCode: 'SYD',
                    },
                ],
            };

            await service.openFlightDetailsDialog(mockEvent, flightData as any);

            expect(
                (window as any).ReactFlightDetailsDialog.openFlightDetailsDialog
            ).toHaveBeenCalledWith(flightData);
        });

        it('should pass minimal flightData without error', async () => {
            const flightData = { flightNumber: 'QF1' };

            await service.openFlightDetailsDialog(mockEvent, flightData as any);

            expect(
                (window as any).ReactFlightDetailsDialog.openFlightDetailsDialog
            ).toHaveBeenCalledWith(flightData);
        });

        it('should pass complex flightData with multiple segments', async () => {
            const flightData = {
                flightNumber: 'NZ789',
                flightSegments: [
                    { segmentOrder: 1, departureAirportFsCode: 'AKL', arrivalAirportFsCode: 'SYD' },
                    { segmentOrder: 2, departureAirportFsCode: 'SYD', arrivalAirportFsCode: 'LAX' },
                ],
            };

            await service.openFlightDetailsDialog(mockEvent, flightData as any);

            expect(
                (window as any).ReactFlightDetailsDialog.openFlightDetailsDialog
            ).toHaveBeenCalledWith(flightData);
        });

        it('should resolve without returning a value', async () => {
            const flightData = { flightNumber: 'NZ100' };

            const result = await service.openFlightDetailsDialog(mockEvent, flightData as any);

            expect(result).toBeUndefined();
        });
    });

    describe('Error Handling', () => {
        it('should rethrow when React dialog load fails', async () => {
            mockHttp.get.mockRejectedValue(new Error('Network error'));

            const flightData = { flightNumber: 'NZ100' };

            await expect(
                service.openFlightDetailsDialog(mockEvent, flightData as any)
            ).rejects.toThrow('Network error');
        });

        it('should rethrow when window global is missing after load', async () => {
            const flightData = { flightNumber: 'NZ100' };

            await expect(
                service.openFlightDetailsDialog(mockEvent, flightData as any)
            ).rejects.toThrow('React flight details dialog not loaded');
        });

        it('should rethrow when dialog rejects with a real error', async () => {
            setupWindowGlobal();
            const dialogError = new Error('Rendering failed');
            (window as any).ReactFlightDetailsDialog.openFlightDetailsDialog.mockRejectedValue(dialogError);

            const flightData = { flightNumber: 'NZ100' };

            await expect(
                service.openFlightDetailsDialog(mockEvent, flightData as any)
            ).rejects.toThrow('Rendering failed');
        });

        it('should rethrow even when error is undefined (no special cancel handling)', async () => {
            setupWindowGlobal();
            (window as any).ReactFlightDetailsDialog.openFlightDetailsDialog.mockRejectedValue(undefined);

            const flightData = { flightNumber: 'NZ100' };

            await expect(
                service.openFlightDetailsDialog(mockEvent, flightData as any)
            ).rejects.toBeUndefined();
        });

        it('should rethrow when ocLazyLoad fails to load module', async () => {
            mockOcLazyLoad.load.mockRejectedValue(new Error('Script load timeout'));

            const flightData = { flightNumber: 'NZ100' };

            await expect(
                service.openFlightDetailsDialog(mockEvent, flightData as any)
            ).rejects.toThrow('Script load timeout');
        });
    });
});
