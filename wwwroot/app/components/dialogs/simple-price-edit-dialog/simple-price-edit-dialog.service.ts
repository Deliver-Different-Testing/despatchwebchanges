import {IJob} from "../../../interfaces/job.interface";
import angular from 'angular';

export type PricingMode = 'recalculate' | 'base' | 'gross';

export interface PriceEditResult {
    mode: PricingMode;
    amount: number;
}

// Type for options passed to the React dialog
interface SimplePriceEditDialogOptionsForReact {
    jobId: number;
    jobNumber: string;
    currentCharge: number;
    isPrebook: boolean;
}

// Type declaration for the React dialog on window
declare global {
    interface Window {
        ReactSimplePriceEditDialog?: {
            open: (options: SimplePriceEditDialogOptionsForReact) => Promise<PriceEditResult | null>;
            setToastService: (service: { showToast: (message: string, type: 'success' | 'warning' | 'error') => void }) => void;
        };
    }
}

class SimplePriceEditDialogService implements angular.IServiceProvider {
    static $inject = [
        '$ocLazyLoad',
        '$http',
        'toastrService',
    ];

    constructor(
        private $ocLazyLoad: oc.ILazyLoad,
        private $http: angular.IHttpService,
        private toastrService: any,
    ) {
        console.log('SimplePriceEditDialogService: Service instantiated');
    }

    $get(): any {
        return this;
    }

    private async loadReactSimplePriceEditDialog(): Promise<void> {
        if (window.ReactSimplePriceEditDialog) {
            return;
        }

        try {
            const manifestResponse = await this.$http.get<Record<string, string>>('dist/manifest.json');
            const manifest = manifestResponse.data;

            const getAssetPath = (filename: string) => `dist/${manifest[filename] || filename}`;

            // Load vendor-react first (if not already loaded)
            if (!(window as any).React) {
                await this.$ocLazyLoad.load(getAssetPath('vendor-react.js'));
            }

            // Load the simple price edit dialog React module
            await this.$ocLazyLoad.load({
                name: 'uDispatch.simplePriceEditDialogReact',
                files: [getAssetPath('simplePriceEditDialogReact.js')]
            });
        } catch (error) {
            console.error('[SimplePriceEditDialogService] Failed to load React dialog:', error);
            throw error;
        }
    }

    async openSimplePriceEditDialog(_$event: MouseEvent, job: IJob, isPrebook: boolean = false): Promise<PriceEditResult> {
        try {
            await this.loadReactSimplePriceEditDialog();

            if (!window.ReactSimplePriceEditDialog) {
                throw new Error('React simple price edit dialog not loaded');
            }

            // Create toast bridge
            window.ReactSimplePriceEditDialog.setToastService({
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
            });

            const result = await window.ReactSimplePriceEditDialog.open({
                jobId: job.id,
                jobNumber: job.jobNo,
                currentCharge: job.charge,
                isPrebook,
            });

            if (!result) {
                // User canceled — throw to match $mdDialog.cancel() behavior
                throw undefined;
            }

            return result;
        } catch (error) {
            if (error === undefined) {
                // Canceled — re-throw for price-breakdown-dialog.service.ts catch handler
                throw error;
            }
            console.error('SimplePriceEditDialogService: Error in openSimplePriceEditDialog', error);
            throw error;
        }
    }
}

export default SimplePriceEditDialogService;
