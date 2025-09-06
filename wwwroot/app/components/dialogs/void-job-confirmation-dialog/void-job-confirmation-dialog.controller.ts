import "./void-job-confirmation-dialog.styles.less";
import BaseController from "../../base-controller";
import {IDispatchJob} from "../../../interfaces/job.interface";
import DispatchCoreService from "../../../services/dispatch-core.service";
import ToastrService from "../../../services/toastr.service";

class VoidJobConfirmationDialogController extends BaseController {
    static $inject = [
        "$mdDialog",
        "DispatchData",
        "toastrService",
        "job"
    ];

    voidReasonText?: string;
    voidSingleJobOnly: boolean = true;

    constructor(
        private $mdDialog: angular.material.IDialogService,
        private DispatchData: DispatchCoreService,
        private toastrService: ToastrService,
        public job: IDispatchJob
    ) {
        super();
    }

    async confirm() {
        try {
            if (this.voidReasonText === undefined || this.voidReasonText.trim() === '') {
                this.toastrService.showWarningToast('Please enter a reason for voiding this job.');
            }
            await this.DispatchData.voidJob(this.job.id, this.voidSingleJobOnly, this.voidReasonText);

            this.voidSingleJobOnly
                ? this.toastrService.showSuccessToast(`Job ${this.job.jobNo} has been voided successfully. Related jobs will not be voided.`)
                : this.toastrService.showSuccessToast(`Job ${this.job.jobNo} and related jobs have been voided successfully.`);

            this.$mdDialog.hide();
        } catch (error: any) {
            this.toastrService.showErrorToast(error.message);
        }

    }

    cancel(): void {
        this.$mdDialog.cancel();
    }
}

export default VoidJobConfirmationDialogController;