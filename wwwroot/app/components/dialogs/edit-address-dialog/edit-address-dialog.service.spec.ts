/** @jest-environment jest-environment-jsdom */
/**
 * Tests for EditAddressDialogService
 *
 * Covers lazy loading, dialog opening with correct parameters, address
 * conversion logic (toReactAddress / toAngularAddress), toast wrapper,
 * and error handling paths.
 */

jest.mock('angular', () => ({ default: { module: jest.fn(() => ({})) }, __esModule: true }));
jest.mock('../../../interfaces/job.interface', () => ({}));
jest.mock('../../../react/interfaces', () => ({}));

import { EditAddressDialogService } from './edit-address-dialog.service';

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

const createMockAppConfig = (isUs: boolean = false) => ({
    US_Customer: isUs,
    US_Coordinates_Center: { lat: 0, lng: 0 },
    NZ_Coordinates_Center: { lat: 0, lng: 0 },
});

/** Helper to build a realistic AngularJS address object. */
const createMockAngularAddress = (overrides: Record<string, any> = {}) => ({
    addressLine1: '123 Queen St',
    addressLine2: 'Level 5',
    addressLine3: '',
    addressLine4: '',
    addressLine5: 'Auckland',
    addressLine6: '',
    addressLine7: '1010',
    addressLine8: '',
    latitude: -36.8485,
    longitude: 174.7633,
    fullAddress: '123 Queen St, Level 5, Auckland, 1010',
    toSuburbId: 100,
    cbd: true,
    address: '123 Queen St',
    our_suburb: 'Auckland CBD',
    stateAbbreviation: 'AKL',
    shipmentDetails: null,
    ...overrides,
});

/** Helper to build a React address result (mirrors EditAddressDialogViewModel). */
const createMockReactAddressResult = (overrides: Record<string, any> = {}) => ({
    addressLine1: '456 Parnell Rd',
    addressLine2: 'Suite 2',
    addressLine3: '',
    addressLine4: '',
    addressLine5: 'Parnell',
    addressLine6: '',
    addressLine7: '1052',
    addressLine8: '',
    latitude: -36.8569,
    longitude: 174.7803,
    fullAddress: '456 Parnell Rd, Suite 2, Parnell, 1052',
    toSuburbId: 200,
    cbd: false,
    address: '456 Parnell Rd',
    our_suburb: 'Parnell',
    stateAbbreviation: 'AKL',
    shipmentDetails: null,
    ...overrides,
});

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('EditAddressDialogService', () => {
    let service: EditAddressDialogService;
    let mockToastr: ReturnType<typeof createMockToastrService>;
    let mockOcLazyLoad: ReturnType<typeof createMockOcLazyLoad>;
    let mockHttp: ReturnType<typeof createMockHttp>;
    let mockAppConfig: ReturnType<typeof createMockAppConfig>;

    beforeEach(() => {
        mockToastr = createMockToastrService();
        mockOcLazyLoad = createMockOcLazyLoad();
        mockHttp = createMockHttp({
            'vendor-react.js': 'vendor-react.abc123.js',
            'editAddressDialogReact.js': 'editAddressDialogReact.xyz789.js',
        });
        mockAppConfig = createMockAppConfig(false);

        service = new EditAddressDialogService(
            mockToastr as any,
            mockOcLazyLoad as any,
            mockHttp as any,
            mockAppConfig as any,
        );

        (window as any).ReactEditAddressDialog = {
            open: jest.fn().mockResolvedValue(createMockReactAddressResult()),
        };

        delete (window as any).React;
    });

    afterEach(() => {
        delete (window as any).ReactEditAddressDialog;
        delete (window as any).React;
    });

    // -----------------------------------------------------------------------
    // Lazy Loading
    // -----------------------------------------------------------------------

    describe('Lazy Loading', () => {
        it('should fetch manifest.json when loading for the first time', async () => {
            delete (window as any).ReactEditAddressDialog;

            mockOcLazyLoad.load.mockImplementation(async (arg: any) => {
                if (typeof arg === 'object' && arg.name) {
                    (window as any).ReactEditAddressDialog = {
                        open: jest.fn().mockResolvedValue(null),
                    };
                }
            });

            await service.openEditAddressDialog(createMockAngularAddress() as any);

            expect(mockHttp.get).toHaveBeenCalledWith('dist/manifest.json');
        });

        it('should load vendor-react with hashed filename when React is not on window', async () => {
            delete (window as any).ReactEditAddressDialog;

            mockOcLazyLoad.load.mockImplementation(async (arg: any) => {
                if (typeof arg === 'object' && arg.name) {
                    (window as any).ReactEditAddressDialog = {
                        open: jest.fn().mockResolvedValue(null),
                    };
                }
            });

            await service.openEditAddressDialog(createMockAngularAddress() as any);

            expect(mockOcLazyLoad.load).toHaveBeenCalledWith('dist/vendor-react.abc123.js');
        });

        it('should skip vendor-react when React is already on window', async () => {
            delete (window as any).ReactEditAddressDialog;
            (window as any).React = {};

            mockOcLazyLoad.load.mockImplementation(async () => {
                (window as any).ReactEditAddressDialog = {
                    open: jest.fn().mockResolvedValue(null),
                };
            });

            await service.openEditAddressDialog(createMockAngularAddress() as any);

            const vendorCalls = mockOcLazyLoad.load.mock.calls.filter(
                (call: any[]) => typeof call[0] === 'string' && call[0].includes('vendor-react')
            );
            expect(vendorCalls).toHaveLength(0);
        });

        it('should load the editAddressDialogReact module with correct name and file', async () => {
            delete (window as any).ReactEditAddressDialog;

            mockOcLazyLoad.load.mockImplementation(async (arg: any) => {
                if (typeof arg === 'object' && arg.name) {
                    (window as any).ReactEditAddressDialog = {
                        open: jest.fn().mockResolvedValue(null),
                    };
                }
            });

            await service.openEditAddressDialog(createMockAngularAddress() as any);

            expect(mockOcLazyLoad.load).toHaveBeenCalledWith({
                name: 'uDispatch.editAddressDialogReact',
                files: ['dist/editAddressDialogReact.xyz789.js'],
            });
        });

        it('should skip loading when ReactEditAddressDialog is already on window', async () => {
            await service.openEditAddressDialog(createMockAngularAddress() as any);

            expect(mockHttp.get).not.toHaveBeenCalled();
            expect(mockOcLazyLoad.load).not.toHaveBeenCalled();
        });

        it('should not reload on subsequent calls (caching)', async () => {
            await service.openEditAddressDialog(createMockAngularAddress() as any);
            await service.openEditAddressDialog(createMockAngularAddress() as any);

            expect(mockHttp.get).not.toHaveBeenCalled();
            expect(mockOcLazyLoad.load).not.toHaveBeenCalled();
        });
    });

    // -----------------------------------------------------------------------
    // Dialog Opening
    // -----------------------------------------------------------------------

    describe('Dialog Opening', () => {
        it('should call ReactEditAddressDialog.open with converted address and default params', async () => {
            const address = createMockAngularAddress();

            await service.openEditAddressDialog(address as any);

            expect((window as any).ReactEditAddressDialog.open).toHaveBeenCalledWith(
                expect.objectContaining({
                    addressLine1: '123 Queen St',
                    addressLine2: 'Level 5',
                    latitude: -36.8485,
                    longitude: 174.7633,
                }),
                'Edit Address',   // default title
                'Save',           // default submitLabel
                false,            // default showContactInfo
                false,            // isUsTenant
                expect.any(Object), // toastService
                undefined,        // addressType
            );
        });

        it('should pass custom title, submitLabel, and showContactInfo', async () => {
            const address = createMockAngularAddress();

            await service.openEditAddressDialog(
                address as any,
                undefined,
                'Set Meeting Point',
                'Split Job',
                true,
            );

            expect((window as any).ReactEditAddressDialog.open).toHaveBeenCalledWith(
                expect.any(Object),
                'Set Meeting Point',
                'Split Job',
                true,
                false,
                expect.any(Object),
                undefined,
            );
        });

        it('should pass isUsTenant=true for US tenant configuration', async () => {
            const usService = new EditAddressDialogService(
                mockToastr as any,
                mockOcLazyLoad as any,
                mockHttp as any,
                createMockAppConfig(true) as any,
            );

            await usService.openEditAddressDialog(createMockAngularAddress() as any);

            expect((window as any).ReactEditAddressDialog.open).toHaveBeenCalledWith(
                expect.any(Object),
                'Edit Address',
                'Save',
                false,
                true,  // isUsTenant
                expect.any(Object),
                undefined,
            );
        });

        it('should return the converted AngularJS address when dialog resolves', async () => {
            const reactResult = createMockReactAddressResult();
            (window as any).ReactEditAddressDialog.open.mockResolvedValue(reactResult);

            const result = await service.openEditAddressDialog(createMockAngularAddress() as any);

            expect(result).toBeDefined();
            expect(result!.addressLine1).toBe('456 Parnell Rd');
            expect(result!.addressLine2).toBe('Suite 2');
            expect(result!.latitude).toBe(-36.8569);
            expect(result!.longitude).toBe(174.7803);
            expect(result!.fullAddress).toBe('456 Parnell Rd, Suite 2, Parnell, 1052');
            expect(result!.toSuburbId).toBe(200);
            expect(result!.cbd).toBe(false);
            expect(result!.address).toBe('456 Parnell Rd');
            expect(result!.our_suburb).toBe('Parnell');
            expect(result!.stateAbbreviation).toBe('AKL');
            expect(result!.shipmentDetails).toBeNull();
        });

        it('should return undefined when the dialog is cancelled (null result)', async () => {
            (window as any).ReactEditAddressDialog.open.mockResolvedValue(null);

            const result = await service.openEditAddressDialog(createMockAngularAddress() as any);

            expect(result).toBeUndefined();
        });
    });

    // -----------------------------------------------------------------------
    // Address Conversion
    // -----------------------------------------------------------------------

    describe('Address Conversion', () => {
        it('should convert empty/null string fields to empty strings in toReactAddress', async () => {
            const address = createMockAngularAddress({
                addressLine1: null,
                addressLine2: undefined,
                addressLine3: '',
                fullAddress: null,
            });

            let capturedAddress: any;
            (window as any).ReactEditAddressDialog.open.mockImplementation(
                (addr: any) => {
                    capturedAddress = addr;
                    return Promise.resolve(null);
                }
            );

            await service.openEditAddressDialog(address as any);

            expect(capturedAddress.addressLine1).toBe('');
            expect(capturedAddress.addressLine2).toBe('');
            expect(capturedAddress.addressLine3).toBe('');
            expect(capturedAddress.fullAddress).toBe('');
        });

        it('should preserve numeric fields (latitude, longitude) as-is', async () => {
            const address = createMockAngularAddress({
                latitude: -36.8485,
                longitude: 174.7633,
            });

            let capturedAddress: any;
            (window as any).ReactEditAddressDialog.open.mockImplementation(
                (addr: any) => {
                    capturedAddress = addr;
                    return Promise.resolve(null);
                }
            );

            await service.openEditAddressDialog(address as any);

            expect(capturedAddress.latitude).toBe(-36.8485);
            expect(capturedAddress.longitude).toBe(174.7633);
        });

        it('should preserve boolean fields (cbd) as-is', async () => {
            const address = createMockAngularAddress({ cbd: true });

            let capturedAddress: any;
            (window as any).ReactEditAddressDialog.open.mockImplementation(
                (addr: any) => {
                    capturedAddress = addr;
                    return Promise.resolve(null);
                }
            );

            await service.openEditAddressDialog(address as any);

            expect(capturedAddress.cbd).toBe(true);
        });

        it('should map all 8 address lines from Angular to React format', async () => {
            const address = createMockAngularAddress({
                addressLine1: 'Line1',
                addressLine2: 'Line2',
                addressLine3: 'Line3',
                addressLine4: 'Line4',
                addressLine5: 'Line5',
                addressLine6: 'Line6',
                addressLine7: 'Line7',
                addressLine8: 'Line8',
            });

            let capturedAddress: any;
            (window as any).ReactEditAddressDialog.open.mockImplementation(
                (addr: any) => {
                    capturedAddress = addr;
                    return Promise.resolve(null);
                }
            );

            await service.openEditAddressDialog(address as any);

            expect(capturedAddress.addressLine1).toBe('Line1');
            expect(capturedAddress.addressLine2).toBe('Line2');
            expect(capturedAddress.addressLine3).toBe('Line3');
            expect(capturedAddress.addressLine4).toBe('Line4');
            expect(capturedAddress.addressLine5).toBe('Line5');
            expect(capturedAddress.addressLine6).toBe('Line6');
            expect(capturedAddress.addressLine7).toBe('Line7');
            expect(capturedAddress.addressLine8).toBe('Line8');
        });

        it('should map stateAbbreviation and shipmentDetails to React format', async () => {
            const address = createMockAngularAddress({
                stateAbbreviation: 'WLG',
                shipmentDetails: { ref: 'SHIP-001' },
            });

            let capturedAddress: any;
            (window as any).ReactEditAddressDialog.open.mockImplementation(
                (addr: any) => {
                    capturedAddress = addr;
                    return Promise.resolve(null);
                }
            );

            await service.openEditAddressDialog(address as any);

            expect(capturedAddress.stateAbbreviation).toBe('WLG');
            expect(capturedAddress.shipmentDetails).toEqual({ ref: 'SHIP-001' });
        });

        it('should convert React address back to Angular format on return', async () => {
            const reactResult = createMockReactAddressResult({
                stateAbbreviation: 'NSW',
                shipmentDetails: { ref: 'SHIP-002' },
            });
            (window as any).ReactEditAddressDialog.open.mockResolvedValue(reactResult);

            const result = await service.openEditAddressDialog(createMockAngularAddress() as any);

            expect(result).toBeDefined();
            expect(result!.stateAbbreviation).toBe('NSW');
            expect(result!.shipmentDetails).toEqual({ ref: 'SHIP-002' });
        });
    });

    // -----------------------------------------------------------------------
    // Toast Wrapper
    // -----------------------------------------------------------------------

    describe('Toast Wrapper', () => {
        let capturedToastService: any;

        beforeEach(async () => {
            (window as any).ReactEditAddressDialog.open.mockImplementation(
                (_addr: any, _title: any, _submit: any, _contact: any, _us: any, toastSvc: any) => {
                    capturedToastService = toastSvc;
                    return Promise.resolve(null);
                }
            );
            await service.openEditAddressDialog(createMockAngularAddress() as any);
        });

        it('should delegate success toast to toastrService.showSuccessToast', () => {
            capturedToastService.showToast('Address saved', 'success');

            expect(mockToastr.showSuccessToast).toHaveBeenCalledWith('Address saved');
        });

        it('should delegate warning toast to toastrService.showWarningToast', () => {
            capturedToastService.showToast('Check address', 'warning');

            expect(mockToastr.showWarningToast).toHaveBeenCalledWith('Check address');
        });

        it('should delegate error toast to toastrService.showErrorToast', () => {
            capturedToastService.showToast('Save failed', 'error');

            expect(mockToastr.showErrorToast).toHaveBeenCalledWith('Save failed');
        });

        it('should not call any toast method for an unrecognized type', () => {
            capturedToastService.showToast('Some info', 'info');

            expect(mockToastr.showSuccessToast).not.toHaveBeenCalled();
            expect(mockToastr.showWarningToast).not.toHaveBeenCalled();
            expect(mockToastr.showErrorToast).not.toHaveBeenCalled();
        });
    });

    // -----------------------------------------------------------------------
    // Error Handling
    // -----------------------------------------------------------------------

    describe('Error Handling', () => {
        it('should throw when lazy loading fails', async () => {
            delete (window as any).ReactEditAddressDialog;
            mockHttp.get.mockRejectedValue(new Error('Network error'));

            await expect(
                service.openEditAddressDialog(createMockAngularAddress() as any)
            ).rejects.toThrow('Network error');
        });

        it('should throw when window global is missing after lazy load', async () => {
            delete (window as any).ReactEditAddressDialog;
            mockOcLazyLoad.load.mockResolvedValue(undefined);

            await expect(
                service.openEditAddressDialog(createMockAngularAddress() as any)
            ).rejects.toThrow('React edit address dialog not loaded');
        });

        it('should propagate errors from the React dialog', async () => {
            (window as any).ReactEditAddressDialog.open.mockRejectedValue(
                new Error('Dialog error')
            );

            await expect(
                service.openEditAddressDialog(createMockAngularAddress() as any)
            ).rejects.toThrow('Dialog error');
        });

        it('should throw when ocLazyLoad.load fails', async () => {
            delete (window as any).ReactEditAddressDialog;
            mockOcLazyLoad.load.mockRejectedValue(new Error('Script load failed'));

            await expect(
                service.openEditAddressDialog(createMockAngularAddress() as any)
            ).rejects.toThrow('Script load failed');
        });
    });

    // -----------------------------------------------------------------------
    // Misc
    // -----------------------------------------------------------------------

    describe('Service structure', () => {
        it('should have correct $inject dependencies', () => {
            expect(EditAddressDialogService.$inject).toEqual([
                'toastrService',
                '$ocLazyLoad',
                '$http',
                'APP_CONFIG',
            ]);
        });

        it('should return itself from $get()', () => {
            expect(service.$get()).toBe(service);
        });
    });
});
