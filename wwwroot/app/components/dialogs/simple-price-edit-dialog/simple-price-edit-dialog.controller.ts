import './simple-price-edit-dialog.styles.less';
import {IJob} from "../../../interfaces/job.interface";
import DispatchCoreService from "../../../services/dispatch-core.service";
import ToastrService from "../../../services/toastr.service";
import BaseController from "../../base-controller";
import angular from 'angular';

type PricingMode = 'recalculate' | 'base' | 'gross';

interface PriceEditResult {
    mode: PricingMode;
    amount: number;
}

class SimplePriceEditDialogController extends BaseController {
    static $inject = [
        '$mdDialog',
        'DispatchData',
        'toastrService',
        '$timeout',
        '$filter',
        '$scope',
        'job',
        'isPrebook'
    ];

    amount: number = 0;
    selectedMode: PricingMode = 'recalculate';

    // Loading and result states
    isLoading: boolean = false;
    showResult: boolean = false;
    savedAmount: number = 0;
    errorMessage: string = '';

    constructor(
        private $mdDialog: angular.material.IDialogService,
        private DispatchData: DispatchCoreService,
        private toastrService: ToastrService,
        $timeout: angular.ITimeoutService,
        $interval: angular.IIntervalService,
        $scope: angular.IScope,
        public job: IJob,
        public isPrebook: boolean
    ) {
        super();
        this.initServices($timeout, $interval, $scope);
        
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
            return 'Saving...';
        }
        switch (this.selectedMode) {
            case 'recalculate':
                return 'Recalculate & Save';
            case 'base':
                return 'Apply Raw Base';
            case 'gross':
                return 'Apply Amount';
            default:
                return 'Apply';
        }
    }

    async submit(): Promise<void> {
        this.isLoading = true;
        this.errorMessage = '';
        this.applyScope();

        try {
            if (this.selectedMode === 'recalculate') {
                // Recalculate and save
                await this.DispatchData.applyRecalculatedJobRate(
                    this.job.id,
                    this.isPrebook
                );
                // Get the new rate to display
                this.savedAmount = await this.DispatchData.recalculateJobRate(
                    this.job.id,
                    this.isPrebook
                );
            } else if (this.selectedMode === 'base') {
                this.savedAmount = await this.DispatchData.repriceJobWithBaseAmount(
                    this.job.id,
                    this.isPrebook,
                    this.amount
                );
            } else if (this.selectedMode === 'gross') {
                await this.DispatchData.simpleRepriceJobManual(
                    this.job.id,
                    this.isPrebook,
                    false,
                    this.amount
                );
                this.savedAmount = this.amount;
            }

            this.showResult = true;
        } catch (error: any) {
            console.error('Error saving price:', error);
            this.errorMessage = error?.data?.message || error?.message || 'Failed to save price. Please try again.';
            this.toastrService.showErrorToast(this.errorMessage);
        } finally {
            this.isLoading = false;
            this.applyScope();
        }
    }

    done(): void {
        const dialogResult: PriceEditResult = {
            mode: this.selectedMode,
            amount: this.savedAmount
        };
        this.$mdDialog.hide(dialogResult);
    }

    cancel(): void {
        this.$mdDialog.cancel();
    }
}

export default SimplePriceEditDialogController;
