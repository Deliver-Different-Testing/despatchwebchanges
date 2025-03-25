import "./price-breakdown-dialog.styles.less";
import ToastrService from "../../../services/toastr.service";
import BaseController from "../../base-controller";
import {PriceBreakdown} from "../../../interfaces/job.interface";
import DispatchCoreService from "../../../services/dispatch-core.service";

export class PriceBreakdownDialogController extends BaseController {
    selectedPriceBreakdown?: PriceBreakdown;
    isEditing: boolean = false;
    isNew: boolean = false;
    priceBreakdownForm: any;

    get totalAmount(): number {
        if (!this.priceBreakdown || this.priceBreakdown.length === 0) {
            return 0;
        }
        return this.priceBreakdown.reduce((sum, item) => sum + (item.amount || 0), 0);
    }

    static $inject = [
        '$mdDialog',
        'toastrService',
        'DispatchData',
        'priceBreakdown',
        'jobId',
        'isPrebook'
    ];

    constructor(
        private $mdDialog: angular.material.IDialogService,
        private toastrService: ToastrService,
        private DispatchData: DispatchCoreService,
        public priceBreakdown: PriceBreakdown[],
        public jobId: number,
        public isPrebook: boolean
    ) {
        super();

        console.log('PriceBreakdownDialogController: Service instantiated');
        console.log('PriceBreakdownDialogController: isPrebook', isPrebook);
        console.log('PriceBreakdownDialogController: jobId', jobId);

        // Initialize if not provided
        if (!this.priceBreakdown) {
            this.priceBreakdown = [];
        }
    }

    editItem(item: PriceBreakdown) {
        this.selectedPriceBreakdown = angular.copy(item);
        this.isEditing = true;
        this.isNew = false;
    }

    addNewItem() {
        this.selectedPriceBreakdown = {
            chargeId: 0,
            name: '',
            amount: 0
        };

        // Set the appropriate job ID
        if (this.isPrebook) {
            this.selectedPriceBreakdown.prebookJobId = this.jobId;
        } else {
            this.selectedPriceBreakdown.jobId = this.jobId;
        }

        this.isEditing = true;
        this.isNew = true;
    }

    cancelEdit() {
        this.selectedPriceBreakdown = undefined;
        this.isEditing = false;
    }

    async saveItem() {
        if (!this.selectedPriceBreakdown || !this.priceBreakdownForm.$valid) {
            this.toastrService.showErrorToast('Please fill out all required fields');
            return;
        }

        try {
            if (this.isNew) {
                // Make sure we're passing the correct data format
                const newBreakdown: PriceBreakdown = {
                    chargeId: 0,
                    name: this.selectedPriceBreakdown.name,
                    amount: this.selectedPriceBreakdown.amount,
                    jobId: this.isPrebook ? undefined : this.jobId,
                    prebookJobId: this.isPrebook ? this.jobId : undefined
                };

                const chargeId = await this.addPriceBreakdown(newBreakdown);
                if (chargeId) {
                    newBreakdown.chargeId = chargeId;
                    this.priceBreakdown.push(newBreakdown);
                    this.toastrService.showSuccessToast('Price breakdown added successfully');
                }
            } else {
                await this.updatePriceBreakdown(this.selectedPriceBreakdown);

                // Update in the local array
                const index = this.priceBreakdown.findIndex(pb => pb.chargeId === this.selectedPriceBreakdown?.chargeId);
                if (index !== -1) {
                    this.priceBreakdown[index] = angular.copy(this.selectedPriceBreakdown);
                }
                this.toastrService.showSuccessToast('Price breakdown updated successfully');
            }

            this.cancelEdit();
        } catch (error) {
            console.error('PriceBreakdownDialogController: Error in save', error);
            this.toastrService.showErrorToast('An error occurred while saving the price breakdown');
        }
    }

    async deleteItem(item: PriceBreakdown) {
        if (confirm('Are you sure you want to delete this price breakdown?')) {
            try {
                await this.deletePriceBreakdown(item.chargeId);

                // Remove from the local array
                const index = this.priceBreakdown.findIndex(pb => pb.chargeId === item.chargeId);
                if (index !== -1) {
                    this.priceBreakdown.splice(index, 1);
                }
                this.toastrService.showSuccessToast('Price breakdown deleted successfully');
            } catch (error) {
                console.error('PriceBreakdownDialogController: Error in delete', error);
                this.toastrService.showErrorToast('An error occurred while deleting the price breakdown');
            }
        }
    }

    private async updatePriceBreakdown(priceBreakdown: PriceBreakdown) {
        await this.DispatchData.updatePriceBreakdown(priceBreakdown);
    }

    private async addPriceBreakdown(priceBreakdown: PriceBreakdown) {
        return await this.DispatchData.addPriceBreakdown(priceBreakdown);
    }

    private async deletePriceBreakdown(chargeId: number) {
        await this.DispatchData.deletePriceBreakdown(chargeId, this.jobId);
    }

    cancel(): void {
        this.$mdDialog.cancel();
    }

    save(): void {
        this.$mdDialog.hide(this.priceBreakdown);
    }
}
