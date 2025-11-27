import './simple-price-edit-dialog.styles.less';
import BaseController from "../../base-controller";
import {IJob} from "../../../interfaces/job.interface";
import DispatchCoreService from "../../../services/dispatch-core.service";
import ToastrService from "../../../services/toastr.service";

class SimplePriceEditDialogController implements angular.IController {
    static $inject = [
        '$mdDialog',
        'DispatchData',
        'toastrService',
        'job'
    ];

    amount: number = 0;

    constructor(
        private $mdDialog: angular.material.IDialogService,
        private DispatchData: DispatchCoreService,
        private toastrService: ToastrService,
        public job: IJob
    ) {
        console.log('SimplePriceEditDialogController: Controller instantiated');
        this.amount = Math.round(job.charge * 100) / 100;
    }

    async recalculatePrice(): Promise<void> {
        try {
            this.amount = await this.DispatchData.recalculateJobRate(this.job.id, this.job.preBook);
            this.toastrService.showSuccessToast('Price recalculated successfully! New price: ' + this.amount.toFixed(2));
        } catch (error) {
            this.toastrService.showErrorToast('An error occurred while recalculating price. Please try again later.');
            console.error(error);
        }
    }

    submit(): void {
        const result = confirm(`Are you sure you want to re-rate this job to ${this.amount.toFixed(2)}?
         This will overwrite any existing charges. Are you sure you want to proceed with this action? ${this.job.jobNo}?`);

        if (!result) return;

        this.$mdDialog.hide(this.amount);
    }

    cancel(): void {
        this.$mdDialog.cancel();
    }
}

export default SimplePriceEditDialogController;