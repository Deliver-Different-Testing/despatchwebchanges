import "./void-job-confirmation-dialog.styles.less";
import BaseController from "../../base-controller";
import {IDispatchJob} from "../../../interfaces/job.interface";
import DispatchCoreService from "../../../services/dispatch-core.service";
import ToastrService from "../../../services/toastr.service";

class VoidJobConfirmationDialogController implements angular.IController {
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
        console.log("VoidJobConfirmationDialogController: Controller instantiated");
    }
    
    $onInit() {
        if(this.job.isBulkJob) {
            console.log("Job is bulk")
        }
    }

    async confirm() {
        try {
            if (!this.voidReasonText || this.voidReasonText.trim() === '') {
                this.toastrService.showWarningToast('Please enter a reason for voiding this job.');
            }
            
            if(this.job.isBulkJob) {
                await this.DispatchData.voidBulkJob(this.job.id, this.voidSingleJobOnly, this.voidReasonText);
            } else {
                await this.DispatchData.voidJob(this.job.id, this.voidSingleJobOnly, this.voidReasonText);
            }

            this.voidSingleJobOnly
                ? this.toastrService.showSuccessToast(`${this.job.jobNo} has been voided successfully. Related jobs will not be voided.`)
                : this.toastrService.showSuccessToast(`${this.job.jobNo} and related jobs have been voided successfully.`);

            this.$mdDialog.hide();
        } catch (error) {
            this.toastrService.showErrorToast("An error occurred while voiding the job. Please try again later.");
        }
    }

    cancel(): void {
        this.$mdDialog.cancel();
    }
}

export default VoidJobConfirmationDialogController;