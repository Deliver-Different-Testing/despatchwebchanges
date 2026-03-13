import {IDispatchJob, IJob} from "../../../interfaces/job.interface";
import ToastrService from "../../../services/toastr.service";
import angular from 'angular';

// Type declaration for the React dialog on window
declare global {
    interface Window {
        ReactAdditionalServicesDialog?: {
            open: (options: {
                job: {
                    id: number;
                    clientId: number;
                    speedId: number;
                    items: number;
                    speedName: string;
                };
                toastService?: {
                    showToast: (message: string, type: 'success' | 'warning' | 'error') => void;
                };
            }) => Promise<boolean>;
        };
    }
}

class AdditionalServicesDialogService implements angular.IServiceProvider {
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
        console.log('AdditionalServicesDialogService: Service instantiated');
    }

    $get() {
        return this;
    }

    /**
     * Load the React additional services dialog module on demand
     */
    private async loadReactDialog(): Promise<void> {
        // Check if already loaded
        if (window.ReactAdditionalServicesDialog) {
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

            // Load the additional services dialog React module
            await this.$ocLazyLoad.load({
                name: 'uDispatch.additionalServicesDialogReact',
                files: [getAssetPath('additionalServicesDialogReact.js')]
            });
        } catch (error) {
            console.error('[AdditionalServicesDialogService] Failed to load React dialog:', error);
            throw error;
        }
    }

    async showAdditionalServicesDialog(_$event: MouseEvent, job: IJob | IDispatchJob) {
        try {
            console.log("Additional Services Dialog opened!");
            console.log("Job: ", job);

            // Load the React dialog module
            await this.loadReactDialog();

            if (!window.ReactAdditionalServicesDialog) {
                throw new Error('React additional services dialog not loaded');
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

            // Open the React dialog (validation happens in React)
            // Note: 'items' and 'speedName' only exist on IJob, not IDispatchJob
            await window.ReactAdditionalServicesDialog.open({
                job: {
                    id: job.id ?? 0,
                    clientId: job.clientId ?? 0,
                    speedId: job.speedId ?? 0,
                    items: 'items' in job ? (job.items ?? 0) : 0,
                    speedName: 'speedName' in job ? (job.speedName ?? '') : (job.speed ?? ''),
                },
                toastService,
            });

            console.log("Additional Services Dialog closed!");
        } catch (error) {
            if (error === undefined) {
                console.log("User canceled dialog!");
            } else {
                console.error("Error in showAdditionalServicesMenu:", error);
            }
        }
    }
}

export default AdditionalServicesDialogService;
