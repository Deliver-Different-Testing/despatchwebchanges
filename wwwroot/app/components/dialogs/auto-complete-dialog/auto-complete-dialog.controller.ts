import DispatchCoreService from "../../../services/dispatch-core.service";
import ToastrService from "../../../services/ToastrService";
import app from "../../../app";
import {SelectOption} from "../../../interfaces/job.interface";

export class AutoCompleteDialogController {
    static $inject = [
        "$mdDialog",
        "DispatchData",
        "toastrService",
        "rateJobService",
        "id",
        "fieldName",
        "title",
        "job",
        "options",
        "existingItem",
        "showRerateOption"
    ];

    id: string;
    isLoading: boolean;
    searchText: string;
    shouldRerateJob: boolean;
    selectedItem: SelectOption | null;
    showRerateOption: boolean;

    constructor(
        private $mdDialog: angular.material.IDialogService,
        private dispatchData: DispatchCoreService,
        private toastrService: ToastrService,
        private rateJobService: any,
        id: string,
        private readonly fieldName: string,
        private readonly title: string,
        private job: Job,
        private options: any,
        existingItem: SelectOption | null,
        showRerateOption: boolean
    ) {
        this.id = id;
        this.isLoading = false;
        this.searchText = "";
        this.shouldRerateJob = false;
        this.selectedItem = existingItem;
        this.showRerateOption = showRerateOption;
    }

    async querySearch(searchTerm: string): Promise<SelectOption[] | undefined> {
        try {
            const url: string = this.options.searchUrl;
            return await this.dispatchData.autocompleteSearch(searchTerm, url);
        } catch (error: any) {
            this.toastrService.showErrorToast(error.message);
        }
    }

    async submit(selectedOption: SelectOption): Promise<void> {
        this.isLoading = true;

        try {
            const reRate: boolean = this.shouldRerateJob;
            const callData = {
                call: "updateDetailField",
                field: this.fieldName,
                value: selectedOption.id,
                jobID: this.job.id
            };

            if (reRate && !this.job.bulkJob) {
                const rate: string = await this.rateJobService.rateJob(this.job);
                await this.dispatchData.updateJobDetail(
                    callData.jobID,
                    callData.field,
                    callData.value,
                    Number(rate.replace(/[^0-9.-]+/g, "")),
                    this.job.preBook
                );
            } else {
                this.job.bulkJob
                    ? await this.dispatchData.updateBulkJobDetail(
                        this.job.id,
                        callData.field,
                        callData.value,
                        this.job.charge,
                        FirstName,
                        ContactID
                    )
                    : await this.dispatchData.updateJobDetail(
                        callData.jobID,
                        callData.field,
                        callData.value,
                        this.job.charge,
                        this.job.preBook
                    );
            }
        } catch (error: any) {
            this.toastrService.showErrorToast(error.message);
        } finally {
            this.isLoading = false;

            // Update field
            const fieldName: string = this.fieldName.toLowerCase();
            const matchingField = Object.keys(this.job).find(
                key => key.toLowerCase() === fieldName
            );

            if (matchingField) {
                (this.job as any)[matchingField] = selectedOption?.id;
            } else {
                console.warn(`Field ${this.fieldName} not found in job object.`);
            }

            if (fieldName === "clientid") {
                this.job.clientName = selectedOption.text;
            }

            this.toastrService.showSuccessToast(
                this.title + " successfully updated to " + selectedOption.text
            );
            this.$mdDialog.hide();
        }
    }

    cancel(): void {
        this.$mdDialog.cancel();
    }
}
