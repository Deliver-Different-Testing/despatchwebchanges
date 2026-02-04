import {IDispatchJob, IJob} from "../../../interfaces/job.interface";
import ToastrService from "../../../services/toastr.service";
import {VoidJobResult, VoidJobDialogJob} from "../../../react/interfaces";
import angular from 'angular';

// Type declaration for the React dialog on window
declare global {
    interface Window {
        ReactVoidJobConfirmationDialog?: {
            open: (
                job: VoidJobDialogJob,
                toastService?: {
                    showToast: (message: string, type: 'success' | 'warning' | 'error') => void;
                }
            ) => Promise<VoidJobResult | null>;
        };
    }
}

class VoidJobConfirmationDialogService implements angular.IServiceProvider {
    static $inject = [
        'toastrService',
        '$ocLazyLoad',
        '$http',
    ];

    constructor(
        private toastrService: ToastrService,
        private $ocLazyLoad: oc.ILazyLoad,
        private $http: angular.IHttpService,
    ) {
        console.log('VoidJobConfirmationDialogService: Service instantiated');
    }

    $get() {
        return this;
    }

    /**
     * Load the React void job confirmation dialog module on demand
     */
    private async loadReactVoidJobConfirmationDialog(): Promise<void> {
        // Check if already loaded
        if (window.ReactVoidJobConfirmationDialog) {
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

            // Load the void job confirmation dialog React module
            await this.$ocLazyLoad.load({
                name: 'uDispatch.voidJobConfirmationDialogReact',
                files: [getAssetPath('voidJobConfirmationDialogReact.js')]
            });
        } catch (error) {
            console.error('[VoidJobConfirmationDialogService] Failed to load React dialog:', error);
            throw error;
        }
    }

    async showVoidConfirmationDialog(_$event: MouseEvent, job: IDispatchJob | IJob): Promise<VoidJobResult | null> {
        try {
            // Load the React dialog module on demand
            await this.loadReactVoidJobConfirmationDialog();

            if (!window.ReactVoidJobConfirmationDialog) {
                throw new Error('React void job confirmation dialog not loaded');
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

            // Map the job to the dialog's expected format
            const dialogJob: VoidJobDialogJob = {
                id: job.id,
                jobNo: job.jobNo,
                isBulkJob: job.isBulkJob,
                isArchived: job.isArchived,
            };

            // Open the React dialog (API calls are now handled internally by React)
            const result = await window.ReactVoidJobConfirmationDialog.open(dialogJob, toastService);

            console.debug('VoidJobConfirmationDialogService: Dialog closed with result:', result);

            return result;
        } catch (error) {
            if (!error) {
                console.debug('User closed dialog');
                return null;
            }

            // Error occurred
            console.error('VoidJobConfirmationDialogService: Error in showVoidConfirmationDialog', error);
            throw error;
        }
    }
}

export default VoidJobConfirmationDialogService;
