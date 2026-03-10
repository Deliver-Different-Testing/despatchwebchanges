/**
 * Tests for EditParcelDimensionsDialogService
 * Covers lazy loading of the React bundle, dialog opening with parameter passing,
 * regular vs bulk job branching, cancellation, and error handling.
 */

jest.mock('angular', () => ({
    default: { module: jest.fn(() => ({})) },
    __esModule: true,
}));

import EditParcelDimensionsDialogService from './edit-parcel-dimensions-dialog.service';
import { IJob, IParcelDimensions } from '../../../interfaces/job.interface';
import { IAppConfig } from '../../../interfaces/app-config.interface';

// --- Mock factories ---

const createMockHttp = (manifestData: Record<string, string> = {}) => ({
    get: jest.fn().mockResolvedValue({ data: manifestData }),
});

const createMockOcLazyLoad = () => ({
    load: jest.fn().mockResolvedValue(undefined),
});

const createMockAppConfig = (usCustomer: boolean = false): IAppConfig => ({
    US_Customer: usCustomer,
    US_Coordinates_Center: { lat: 0, lng: 0 },
    NZ_Coordinates_Center: { lat: 0, lng: 0 },
});

const mockEvent = {} as MouseEvent;

const sampleParcels: IParcelDimensions[] = [
    { itemName: 'Box A', length: 10, depth: 20, height: 15, dimensions: '10 × 20 × 15 cm' },
    { itemName: 'Box B', length: 5, depth: 5, height: 5, dimensions: '5 × 5 × 5 cm' },
];

const createMockJob = (overrides: Partial<IJob> = {}): IJob => ({
    id: 101,
    isBulkJob: false,
    parcelDimensions: sampleParcels,
    ...overrides,
} as IJob);

describe('EditParcelDimensionsDialogService', () => {
    let service: EditParcelDimensionsDialogService;
    let mockHttp: ReturnType<typeof createMockHttp>;
    let mockOcLazyLoad: ReturnType<typeof createMockOcLazyLoad>;
    let mockAppConfig: IAppConfig;

    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation();
        jest.spyOn(console, 'error').mockImplementation();
        jest.spyOn(console, 'debug').mockImplementation();

        mockHttp = createMockHttp({
            'vendor-react.js': 'vendor-react.abc123.js',
            'editParcelDimensionsDialogReact.js': 'editParcelDimensionsDialogReact.xyz789.js',
        });
        mockOcLazyLoad = createMockOcLazyLoad();
        mockAppConfig = createMockAppConfig(false);

        service = new EditParcelDimensionsDialogService(
            mockOcLazyLoad as any,
            mockHttp as any,
            mockAppConfig,
        );

        delete (window as any).React;
        delete (window as any).ReactEditParcelDimensionsDialog;
    });

    afterEach(() => {
        delete (window as any).ReactEditParcelDimensionsDialog;
        delete (window as any).React;
        jest.restoreAllMocks();
    });

    function setupWindowGlobal(result: IParcelDimensions[] | null = sampleParcels) {
        (window as any).ReactEditParcelDimensionsDialog = {
            showEditParcelDimensionsDialog: jest.fn().mockResolvedValue(result),
        };
    }

    describe('Service structure', () => {
        it('should have $inject with the expected dependencies', () => {
            expect(EditParcelDimensionsDialogService.$inject).toEqual([
                '$ocLazyLoad',
                '$http',
                'APP_CONFIG',
            ]);
        });

        it('should implement $get returning itself', () => {
            expect(service.$get()).toBe(service);
        });
    });

    describe('Lazy Loading', () => {
        it('should fetch manifest.json on first dialog open', async () => {
            await service.showJobDimensionsDialog(
                mockEvent, createMockJob()
            ).catch(() => {});

            expect(mockHttp.get).toHaveBeenCalledWith('dist/manifest.json');
        });

        it('should load vendor-react.js with hashed filename from manifest', async () => {
            await service.showJobDimensionsDialog(
                mockEvent, createMockJob()
            ).catch(() => {});

            expect(mockOcLazyLoad.load).toHaveBeenCalledWith('dist/vendor-react.abc123.js');
        });

        it('should load the dialog React module with hashed filename', async () => {
            await service.showJobDimensionsDialog(
                mockEvent, createMockJob()
            ).catch(() => {});

            expect(mockOcLazyLoad.load).toHaveBeenCalledWith({
                name: 'uDispatch.editParcelDimensionsDialogReact',
                files: ['dist/editParcelDimensionsDialogReact.xyz789.js'],
            });
        });

        it('should skip vendor-react loading if window.React already exists', async () => {
            (window as any).React = {};

            await service.showJobDimensionsDialog(
                mockEvent, createMockJob()
            ).catch(() => {});

            expect(mockOcLazyLoad.load).toHaveBeenCalledTimes(1);
            expect(mockOcLazyLoad.load).toHaveBeenCalledWith({
                name: 'uDispatch.editParcelDimensionsDialogReact',
                files: ['dist/editParcelDimensionsDialogReact.xyz789.js'],
            });
        });

        it('should skip loading entirely if ReactEditParcelDimensionsDialog is already on window', async () => {
            setupWindowGlobal();

            await service.showJobDimensionsDialog(mockEvent, createMockJob());

            expect(mockHttp.get).not.toHaveBeenCalled();
            expect(mockOcLazyLoad.load).not.toHaveBeenCalled();
        });

        it('should fall back to unmangled filename when manifest does not contain entry', async () => {
            mockHttp = createMockHttp({});
            service = new EditParcelDimensionsDialogService(
                mockOcLazyLoad as any,
                mockHttp as any,
                mockAppConfig,
            );

            await service.showJobDimensionsDialog(
                mockEvent, createMockJob()
            ).catch(() => {});

            expect(mockOcLazyLoad.load).toHaveBeenCalledWith('dist/vendor-react.js');
            expect(mockOcLazyLoad.load).toHaveBeenCalledWith({
                name: 'uDispatch.editParcelDimensionsDialogReact',
                files: ['dist/editParcelDimensionsDialogReact.js'],
            });
        });
    });

    describe('Dialog Opening — Regular Job', () => {
        beforeEach(() => {
            setupWindowGlobal();
        });

        it('should pass jobId and parcels for a regular job', async () => {
            const job = createMockJob({ id: 42, isBulkJob: false });

            await service.showJobDimensionsDialog(mockEvent, job);

            expect(
                (window as any).ReactEditParcelDimensionsDialog.showEditParcelDimensionsDialog
            ).toHaveBeenCalledWith({
                parcels: sampleParcels,
                jobId: 42,
                bulkJobId: undefined,
                isUsCustomer: false,
            });
        });

        it('should pass isUsCustomer true when APP_CONFIG.US_Customer is true', async () => {
            service = new EditParcelDimensionsDialogService(
                mockOcLazyLoad as any,
                mockHttp as any,
                createMockAppConfig(true),
            );
            setupWindowGlobal();

            const job = createMockJob({ id: 7 });

            await service.showJobDimensionsDialog(mockEvent, job);

            const call = (window as any).ReactEditParcelDimensionsDialog
                .showEditParcelDimensionsDialog.mock.calls[0][0];
            expect(call.isUsCustomer).toBe(true);
        });

        it('should ignore $event parameter (kept for API compat)', async () => {
            const customEvent = { clientX: 100, clientY: 200 } as MouseEvent;

            await service.showJobDimensionsDialog(customEvent, createMockJob());

            const call = (window as any).ReactEditParcelDimensionsDialog
                .showEditParcelDimensionsDialog.mock.calls[0][0];
            expect(call).not.toHaveProperty('$event');
            expect(call).not.toHaveProperty('clientX');
        });
    });

    describe('Dialog Opening — Bulk Job', () => {
        beforeEach(() => {
            setupWindowGlobal();
        });

        it('should pass bulkJobId instead of jobId for a bulk job', async () => {
            const job = createMockJob({ id: 99, isBulkJob: true });

            await service.showJobDimensionsDialog(mockEvent, job);

            expect(
                (window as any).ReactEditParcelDimensionsDialog.showEditParcelDimensionsDialog
            ).toHaveBeenCalledWith({
                parcels: sampleParcels,
                jobId: undefined,
                bulkJobId: 99,
                isUsCustomer: false,
            });
        });
    });

    describe('Dialog Opening — Parcel Data', () => {
        beforeEach(() => {
            setupWindowGlobal();
        });

        it('should pass the job parcelDimensions array directly', async () => {
            const customParcels: IParcelDimensions[] = [
                { itemName: 'Fragile', length: 1, depth: 2, height: 3, dimensions: '1 × 2 × 3 cm', barcode: 'BC001' },
            ];
            const job = createMockJob({ parcelDimensions: customParcels });

            await service.showJobDimensionsDialog(mockEvent, job);

            const call = (window as any).ReactEditParcelDimensionsDialog
                .showEditParcelDimensionsDialog.mock.calls[0][0];
            expect(call.parcels).toBe(customParcels);
        });

        it('should handle empty parcel array', async () => {
            const job = createMockJob({ parcelDimensions: [] });

            await service.showJobDimensionsDialog(mockEvent, job);

            const call = (window as any).ReactEditParcelDimensionsDialog
                .showEditParcelDimensionsDialog.mock.calls[0][0];
            expect(call.parcels).toEqual([]);
        });
    });

    describe('Cancellation', () => {
        it('should resolve without error when dialog returns null (user cancelled)', async () => {
            setupWindowGlobal(null);

            await expect(
                service.showJobDimensionsDialog(mockEvent, createMockJob())
            ).resolves.toBeUndefined();
        });
    });

    describe('Error Handling', () => {
        it('should throw when React dialog load fails (manifest fetch error)', async () => {
            mockHttp.get.mockRejectedValue(new Error('Network error'));

            await expect(
                service.showJobDimensionsDialog(mockEvent, createMockJob())
            ).rejects.toThrow('Network error');
        });

        it('should throw when window global is missing after load', async () => {
            await expect(
                service.showJobDimensionsDialog(mockEvent, createMockJob())
            ).rejects.toThrow('React edit parcel dimensions dialog not loaded');
        });

        it('should throw when ocLazyLoad fails to load module', async () => {
            mockOcLazyLoad.load.mockRejectedValue(new Error('CDN timeout'));

            await expect(
                service.showJobDimensionsDialog(mockEvent, createMockJob())
            ).rejects.toThrow('CDN timeout');
        });

        it('should rethrow when the React dialog rejects with an error', async () => {
            setupWindowGlobal();
            (window as any).ReactEditParcelDimensionsDialog
                .showEditParcelDimensionsDialog.mockRejectedValue(
                    new Error('Save failed')
                );

            await expect(
                service.showJobDimensionsDialog(mockEvent, createMockJob())
            ).rejects.toThrow('Save failed');
        });
    });
});
