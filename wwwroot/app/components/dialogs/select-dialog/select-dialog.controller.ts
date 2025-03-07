import DispatchService from "../../../services/dispatch.service";
import ToastrService from "../../../services/toastr.service";
import {Job} from "../../../interfaces/job.interface";
import app from "../../../app";

class SelectDialogController {
    static $inject = ["$mdDialog", "DispatchData", "toastrService", "rateJobService", "id", "fieldName", "title", "job", "options", "initialValue", "showCheckbox", "checkboxLabel"];

    isLoading: boolean;
    selectedOption: any;
    warningMessage: string;
    checkboxValue: boolean;

    constructor(
        private $mdDialog: angular.material.IDialogService,
        private DispatchData: DispatchService,
        private toastrService: ToastrService,
        private rateJobService: any,
        public id: number,
        public fieldName: string,
        public title: string,
        public job: Job,
        public options: any,
        public initialValue: string | null,
        public showCheckbox: boolean,
        public checkboxLabel: string
    ) {
        this.isLoading = false;
        this.selectedOption = null;

        // Warning message
        this.warningMessage = fieldName === "Status" ?
            "Warning: You are about to change the status of a job. Different statuses trigger different notifications and automated workflows. " +
            "While this change can be reversed, it may impact multiple systems and stakeholders. Please ensure you're selecting the correct status."
            : "";
        this.checkboxValue = false;

        if (initialValue) {
            this.selectedOption = this.findInitialValue(options, initialValue);
        }
    }

    private findInitialValue(options: any, initialValue: string): any | null {
        return options.items.find((option: any) =>
            option.text === initialValue || option.id === initialValue
        ) ?? null;
    }

    async submit(selectedOption: any): Promise<void> {
        try {
            this.isLoading = true;

            if (this.fieldName === "DGClass") {
                await this.updateDgClass(selectedOption);
                this.job.dgClass = selectedOption.id;
            } else {
                await this.updateJobDetails(selectedOption);
            }

            this.$mdDialog.hide();
        } catch (error: any) {
            this.toastrService.showErrorToast(error.message);
        } finally {
            this.isLoading = false;
        }
    }

    private async updateJobDetails(selectedOption: any): Promise<void> {
        this.job.charge = await this.rateJobService.rateJob(this.job);

        if (this.job.bulkJob) {
            await this.DispatchData.updateBulkJobDetail(this.job.id, this.fieldName, selectedOption.id, this.job.charge, FirstName, ContactID);
        } else {
            await this.DispatchData.updateJobDetail(this.job.id, this.fieldName, selectedOption.id, this.job.charge, this.job.preBook);
        }
    }

    private async updateDgClass(selectedOption: any): Promise<void> {
        await this.DispatchData.updateJobDetail(this.job.id, this.fieldName, selectedOption.id, this.job.charge, this.job.preBook);

        if (this.job.dgDocumentation !== this.checkboxValue) {
            this.job.dgDocumentation = this.checkboxValue;
            await this.DispatchData.updateJobDetail(this.job.id, "DGDocumentation", this.job.dgDocumentation, this.job.charge, this.job.preBook);
        }
    }

    cancel(): void {
        this.$mdDialog.cancel();
    }
}

app.controller("SelectDialogController", SelectDialogController);
