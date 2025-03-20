import "./price-breakdown-dialog.styles.less";
import ToastrService from "../../../services/ToastrService";
import BaseController from "../../base-controller";
import {PriceBreakdown} from "../../../interfaces/job.interface";
import DispatchCoreService from "../../../services/dispatch-core.service";

export class PriceBreakdownDialogController extends BaseController {
    selectedPriceBreakdown?: PriceBreakdown;
    isEditing: boolean = false;
    isNew: boolean = false;
    priceBreakdownForm: any;

    static $inject = [
        '$mdDialog',
        '$http',
        'toastrService',
        'DispatchData',
        'priceBreakdown',
        'jobId',
        'isPrebook'
    ];

    constructor(
        private $mdDialog: angular.material.IDialogService,
        private $http: angular.IHttpService,
        private toastrService: ToastrService,
        private DispatchData: DispatchCoreService,
        public priceBreakdown: PriceBreakdown[],
        public jobId: number,
        public isPrebook: boolean
    ) {
        super();

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
        // Create a new item based on whether this is a prebook or regular job
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
                await this.addPriceBreakdown(this.selectedPriceBreakdown);
                this.toastrService.showSuccessToast('Price breakdown added successfully');
                // Add to the local array
                this.priceBreakdown.push(this.selectedPriceBreakdown);
            } else {
                await this.updatePriceBreakdown(this.selectedPriceBreakdown);
                this.toastrService.showSuccessToast('Price breakdown updated successfully');
                // Update in the local array
                const index = this.priceBreakdown.findIndex(pb => pb.chargeId === this.selectedPriceBreakdown?.chargeId);
                if (index !== -1) {
                    this.priceBreakdown[index] = this.selectedPriceBreakdown;
                }
            }

            this.cancelEdit();
        } catch (error) {
            console.error('PriceBreakdownDialogController: Error in save', error);
            this.toastrService.showErrorToast();
        }
    }

    async deleteItem(item: PriceBreakdown) {
        if (confirm('Are you sure you want to delete this price breakdown?')) {
            try {
                await this.deletePriceBreakdown(item);
                this.toastrService.showSuccessToast('Price breakdown deleted successfully');
                // Remove from the local array
                const index = this.priceBreakdown.findIndex(pb => pb.chargeId === item.chargeId);
                if (index !== -1) {
                    this.priceBreakdown.splice(index, 1);
                }
            } catch (error) {
                console.error('PriceBreakdownDialogController: Error in delete', error);
                this.toastrService.showErrorToast();
            }
        }
    }

    private async updatePriceBreakdown(priceBreakdown: PriceBreakdown) {
        await this.$http.post('pricing/UpdatePriceBreakdown', priceBreakdown);
    }

    private async addPriceBreakdown(priceBreakdown: PriceBreakdown) {
        const result = await this.DispatchData.addPriceBreakdown(priceBreakdown);
        if (!result) return;

        priceBreakdown.chargeId = result;
    }


    private async deletePriceBreakdown(priceBreakdown: PriceBreakdown) {
        await this.$http.post('pricing/DeletePriceBreakdown', {chargeId: priceBreakdown.chargeId});
    }

    cancel(): void {
        this.$mdDialog.cancel();
    }

    save(): void {
        this.$mdDialog.hide(this.priceBreakdown);
    }
}
