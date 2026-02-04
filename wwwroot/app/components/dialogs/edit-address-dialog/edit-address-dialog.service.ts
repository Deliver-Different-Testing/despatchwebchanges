import {IAddressViewModel, IEditAddressDialogViewModel} from "../../../interfaces/job.interface";
import {EditAddressDialogViewModel} from "../../../react/interfaces";
import ToastrService from "../../../services/toastr.service";
import {IAppConfig} from "../../../interfaces/app-config.interface";
import angular from 'angular';

// Type declaration for the React dialog on window
declare global {
    interface Window {
        ReactEditAddressDialog?: {
            open: (
                addressDetails: EditAddressDialogViewModel | null,
                title: string,
                submitLabel: string,
                showContactInfo: boolean,
                isUsTenant: boolean,
                toastService?: {
                    showToast: (message: string, type: 'success' | 'warning' | 'error') => void;
                }
            ) => Promise<EditAddressDialogViewModel | null>;
        };
    }
}

export class EditAddressDialogService implements angular.IServiceProvider {
    static $inject = [
        'toastrService',
        '$ocLazyLoad',
        '$http',
        'APP_CONFIG',
    ];

    private readonly isUsTenant: boolean;

    constructor(
        private toastrService: ToastrService,
        private $ocLazyLoad: oc.ILazyLoad,
        private $http: angular.IHttpService,
        appConfig: IAppConfig,
    ) {
        console.debug('EditAddressDialogService: Service instantiated');
        this.isUsTenant = appConfig.US_Customer;
    }

    $get() {
        return this;
    }

    /**
     * Load the React edit address dialog module on demand
     */
    private async loadReactEditAddressDialog(): Promise<void> {
        // Check if already loaded
        if (window.ReactEditAddressDialog) {
            return;
        }

        try {
            // Load the manifest to get hashed filenames
            const manifestResponse = await this.$http.get<Record<string, string>>('dist/manifest.json');
            const manifest = manifestResponse.data;

            const getAssetPath = (filename: string) => `dist/${manifest[filename] || filename}`;

            // Load vendor-react first (if not already loaded)
            if (!(window as any).React) {
                await this.$ocLazyLoad.load(getAssetPath('vendor-react.js'));
            }

            // Load the edit address dialog React module
            await this.$ocLazyLoad.load({
                name: 'uDispatch.editAddressDialogReact',
                files: [getAssetPath('editAddressDialogReact.js')]
            });
        } catch (error) {
            console.error('[EditAddressDialogService] Failed to load React dialog:', error);
            throw error;
        }
    }

    /**
     * Convert AngularJS address to React format
     * (The interfaces are essentially the same, just ensuring proper types)
     */
    private toReactAddress(address: IAddressViewModel): EditAddressDialogViewModel {
        return {
            addressLine1: address.addressLine1 || '',
            addressLine2: address.addressLine2 || '',
            addressLine3: address.addressLine3 || '',
            addressLine4: address.addressLine4 || '',
            addressLine5: address.addressLine5 || '',
            addressLine6: address.addressLine6 || '',
            addressLine7: address.addressLine7 || '',
            addressLine8: address.addressLine8 || '',
            latitude: address.latitude,
            longitude: address.longitude,
            fullAddress: address.fullAddress || '',
            toSuburbId: address.toSuburbId,
            cbd: address.cbd,
            address: address.address,
            our_suburb: address.our_suburb,
            stateAbbreviation: (address as IEditAddressDialogViewModel).stateAbbreviation,
            shipmentDetails: (address as IEditAddressDialogViewModel).shipmentDetails,
        };
    }

    /**
     * Convert React address back to AngularJS format
     */
    private toAngularAddress(address: EditAddressDialogViewModel): IEditAddressDialogViewModel {
        return {
            addressLine1: address.addressLine1,
            addressLine2: address.addressLine2,
            addressLine3: address.addressLine3,
            addressLine4: address.addressLine4,
            addressLine5: address.addressLine5,
            addressLine6: address.addressLine6,
            addressLine7: address.addressLine7,
            addressLine8: address.addressLine8,
            latitude: address.latitude,
            longitude: address.longitude,
            fullAddress: address.fullAddress,
            toSuburbId: address.toSuburbId,
            cbd: address.cbd,
            address: address.address,
            our_suburb: address.our_suburb,
            stateAbbreviation: address.stateAbbreviation,
            shipmentDetails: address.shipmentDetails,
        };
    }

    async openEditAddressDialog(
        addressDetails: IAddressViewModel,
        _$event?: MouseEvent,
        title: string = 'Edit Address',
        submitLabel: string = 'Save',
        showContactInfo: boolean = false
    ): Promise<IEditAddressDialogViewModel | undefined> {
        try {
            console.debug('EditAddressDialogService: Opening dialog for address:', addressDetails);

            // Load the React dialog module on demand
            await this.loadReactEditAddressDialog();

            if (!window.ReactEditAddressDialog) {
                throw new Error('React edit address dialog not loaded');
            }

            // Create toast service wrapper for UI notifications
            const toastService = {
                showToast: (message: string, type: 'success' | 'warning' | 'error') => {
                    switch (type) {
                        case 'success':
                            this.toastrService.showSuccessToast(message);
                            break;
                        case 'warning':
                            this.toastrService.showWarningToast(message);
                            break;
                        case 'error':
                            this.toastrService.showErrorToast(message);
                            break;
                    }
                },
            };

            // Convert the address to React format
            const reactAddress = this.toReactAddress(addressDetails);

            // Open the React dialog
            const result = await window.ReactEditAddressDialog.open(
                reactAddress,
                title,
                submitLabel,
                showContactInfo,
                this.isUsTenant,
                toastService
            );

            console.debug('EditAddressDialogService: Dialog resolved with:', result);

            if (!result) {
                // Dialog was canceled
                return undefined;
            }

            // Convert result back to AngularJS format
            return this.toAngularAddress(result);
        } catch (error) {
            console.error('EditAddressDialogService: Error in openEditAddressDialog', error);
            throw error;
        }
    }
}
