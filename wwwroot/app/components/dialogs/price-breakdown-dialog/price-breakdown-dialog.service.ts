import DispatchCoreService from "../../../services/dispatch-core.service";
import {IJob, PriceBreakdown} from "../../../interfaces/job.interface";
import ToastrService from "../../../services/toastr.service";
import SimplePriceEditDialogService, {
    PriceEditResult
} from "../simple-price-edit-dialog/simple-price-edit-dialog.service";
import {IAppConfig} from "../../../interfaces/app-config.interface";

// Type declaration for the React dialog on window
declare global {
    interface Window {
        ReactPriceBreakdownDialog?: {
            open: (
                priceBreakdowns: PriceBreakdown[],
                jobId: number,
                isPrebook: boolean,
                apiService: {
                    addPriceBreakdown: (breakdown: Omit<PriceBreakdown, 'chargeId'>) => Promise<number>;
                    updatePriceBreakdown: (breakdown: PriceBreakdown) => Promise<void>;
                    deletePriceBreakdown: (chargeId: number, jobId: number) => Promise<void>;
                }
            ) => Promise<number | null>;
        };
    }
}

class PriceBreakdownDialogService implements angular.IServiceProvider {
    static $inject = [
        'DispatchData',
        'toastrService',
        'APP_CONFIG',
        "simplePriceEditDialogService",
        '$ocLazyLoad',
        '$http',
    ];

    private readonly isUsCustomer: boolean;

    constructor(
        private DispatchData: DispatchCoreService,
        private toastrService: ToastrService,
        appConfig: IAppConfig,
        private simplePriceEditDialogService: SimplePriceEditDialogService,
        private $ocLazyLoad: oc.ILazyLoad,
        private $http: angular.IHttpService,
    ) {
        console.debug('PriceBreakdownDialogService: Service instantiated');
        this.isUsCustomer = appConfig.US_Customer;
    }

    $get(): this {
        return this;
    }

    private isUsingOldAmountMethod(jobAmount?: number, priceBreakdowns?: PriceBreakdown[]): boolean {
        // US Customers always get pricing breakdown
        if (this.isUsCustomer) return false;

        const isUsingOldMethod = !!jobAmount && jobAmount > 0 && (!priceBreakdowns || priceBreakdowns.length === 0);
        console.log('Job isUsingOldAmountMethod', isUsingOldMethod);
        return isUsingOldMethod;
    }

    private async handlePriceEditResult(result: PriceEditResult, job: IJob): Promise<number> {
        switch (result.mode) {
            case 'recalculate':
                // Price was already calculated and applied in the dialog
                this.toastrService.showSuccessToast(`Price recalculated to $${result.amount.toFixed(2)}`);
                return result.amount;

            case 'base':
                // Price was already calculated and applied in the dialog
                this.toastrService.showSuccessToast(`Price updated to $${result.amount.toFixed(2)} (base + surcharges)`);
                return result.amount;

            case 'gross':
                await this.DispatchData.simpleRepriceJobManual(job.id, job.preBook, job.isBulkJob, result.amount);
                this.toastrService.showSuccessToast(`Price set to $${result.amount.toFixed(2)}`);
                return result.amount;

            default:
                throw new Error(`Unknown pricing mode: ${result.mode}`);
        }
    }

    /**
     * Load the React price breakdown dialog module on demand
     */
    private async loadReactPriceBreakdownDialog(): Promise<void> {
        // Check if already loaded
        if (window.ReactPriceBreakdownDialog) {
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

            // Load the price breakdown dialog React module
            await this.$ocLazyLoad.load({
                name: 'uDispatch.priceBreakdownDialogReact',
                files: [getAssetPath('priceBreakdownDialogReact.js')]
            });
        } catch (error) {
            console.error('[PriceBreakdownDialogService] Failed to load React dialog:', error);
            throw error;
        }
    }

    async openPriceBreakdownDialog($event: MouseEvent,
                                   job: IJob): Promise<number | undefined> {
        try {
            const priceBreakdowns: PriceBreakdown[] = await this.DispatchData.getPriceBreakdown(job.id, job.preBook);

            // Check if using the old amount method and just show text
            if(this.isUsingOldAmountMethod(job.charge, priceBreakdowns)) {
                try {
                    const result = await this.simplePriceEditDialogService.openSimplePriceEditDialog($event, job, job.preBook);
                    return await this.handlePriceEditResult(result, job);
                } catch (error) {
                    if(!error) return;

                    this.toastrService.showErrorToast('Job amount update failed.');
                    console.error('PriceBreakdownDialogService: Error in openPriceBreakdownDialog', error);
                    return;
                }
            }

            // Load the React dialog module on demand
            await this.loadReactPriceBreakdownDialog();

            if (!window.ReactPriceBreakdownDialog) {
                throw new Error('React price breakdown dialog not loaded');
            }

            // Create API service wrapper
            const apiService = {
                addPriceBreakdown: (breakdown: Omit<PriceBreakdown, 'chargeId'>) =>
                    this.DispatchData.addPriceBreakdown(breakdown as PriceBreakdown),
                updatePriceBreakdown: (breakdown: PriceBreakdown) =>
                    this.DispatchData.updatePriceBreakdown(breakdown),
                deletePriceBreakdown: (chargeId: number, jobId: number) =>
                    this.DispatchData.deletePriceBreakdown(chargeId, jobId),
            };

            // Open the React dialog
            const newAmount = await window.ReactPriceBreakdownDialog.open(
                priceBreakdowns,
                job.id,
                job.preBook,
                apiService
            );

            console.debug('PriceBreakdownDialogService: Dialog closed!');

            return newAmount ?? undefined;
        } catch (error) {
            if(!error) {
                console.debug('User closed dialog');
                return;
            }

            // Error occurred
            console.error('PriceBreakdownDialogService: Error in openPriceBreakdownDialog', error);
            throw error;
        }
    }
}

export default PriceBreakdownDialogService;
