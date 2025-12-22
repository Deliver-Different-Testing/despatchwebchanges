import './simple-price-edit-dialog.styles.less';
import {IJob} from "../../../interfaces/job.interface";
import DispatchCoreService from "../../../services/dispatch-core.service";
import ToastrService from "../../../services/toastr.service";

type PricingMode = 'recalculate' | 'base' | 'gross';

interface PriceEditResult {
    mode: PricingMode;
    amount: number;
}

class SimplePriceEditDialogController implements angular.IController {
    static $inject = [
        '$mdDialog',
        'DispatchData',
        'toastrService',
        'job',
        'isPrebook'
    ];

    amount: number = 0;
    selectedMode: PricingMode = 'recalculate';

    // Loading and confirmation states
    isLoading: boolean = false;
    showConfirmation: boolean = false;
    calculatedAmount: number = 0;
    errorMessage: string = '';

    // Store base amount for confirm step (for 'base' mode)
    private pendingBaseAmount: number = 0;

    constructor(
        private $mdDialog: angular.material.IDialogService,
        private DispatchData: DispatchCoreService,
        private toastrService: ToastrService,
        public job: IJob,
        public isPrebook: boolean
    ) {
        console.log('SimplePriceEditDialogController: Controller instantiated');
        this.amount = Math.round(job.charge * 100) / 100;
    }

    isSubmitDisabled(): boolean {
        if (this.isLoading) return true;
        if (this.selectedMode === 'recalculate') {
            return false;
        }
        return !this.amount || this.amount <= 0;
    }

    getSubmitButtonText(): string {
        if (this.isLoading) {
            return 'Calculating...';
        }
        switch (this.selectedMode) {
            case 'recalculate':
                return 'Calculate';
            case 'base':
                return 'Calculate Total';
            case 'gross':
                return 'Apply Gross Amount';
            default:
                return 'Apply';
        }
    }

    async submit(): Promise<void> {
        // For gross amount, just close with the result (no API call needed)
        if (this.selectedMode === 'gross') {
            const dialogResult: PriceEditResult = {
                mode: this.selectedMode,
                amount: this.amount
            };
            this.$mdDialog.hide(dialogResult);
            return;
        }

        // For recalculate and base amount, call the preview API and show confirmation
        this.isLoading = true;
        this.errorMessage = '';

        try {
            if (this.selectedMode === 'recalculate') {
                // Preview only - doesn't save
                this.calculatedAmount = await this.DispatchData.recalculateJobRate(
                    this.job.id,
                    this.isPrebook
                );
            } else if (this.selectedMode === 'base') {
                // Preview only - doesn't save
                this.pendingBaseAmount = this.amount;
                this.calculatedAmount = await this.DispatchData.calculateJobPriceWithBaseAmount(
                    this.job.id,
                    this.isPrebook,
                    this.amount
                );
            }

            this.showConfirmation = true;
        } catch (error: any) {
            console.error('Error calculating price:', error);
            this.errorMessage = error?.data?.message || error?.message || 'Failed to calculate price. Please try again.';
            this.toastrService.showErrorToast(this.errorMessage);
        } finally {
            this.isLoading = false;
        }
    }

    async confirmPrice(): Promise<void> {
        this.isLoading = true;
        this.errorMessage = '';

        try {
            // Actually save the calculated price
            if (this.selectedMode === 'recalculate') {
                await this.DispatchData.applyRecalculatedJobRate(
                    this.job.id,
                    this.isPrebook
                );
            } else if (this.selectedMode === 'base') {
                await this.DispatchData.repriceJobWithBaseAmount(
                    this.job.id,
                    this.isPrebook,
                    this.pendingBaseAmount
                );
            }

            const dialogResult: PriceEditResult = {
                mode: this.selectedMode,
                amount: this.calculatedAmount
            };
            this.$mdDialog.hide(dialogResult);
        } catch (error: any) {
            console.error('Error applying price:', error);
            this.errorMessage = error?.data?.message || error?.message || 'Failed to apply price. Please try again.';
            this.toastrService.showErrorToast(this.errorMessage);
        } finally {
            this.isLoading = false;
        }
    }

    backToEdit(): void {
        this.showConfirmation = false;
        this.calculatedAmount = 0;
        this.errorMessage = '';
    }

    cancel(): void {
        this.$mdDialog.cancel();
    }
}

export default SimplePriceEditDialogController;