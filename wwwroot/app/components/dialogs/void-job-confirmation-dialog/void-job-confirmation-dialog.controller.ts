import "./void-job-confirmation-dialog.styles.less";
import {IDispatchJob, IMultiSuggestion} from "../../../interfaces/job.interface";
import DispatchCoreService from "../../../services/dispatch-core.service";
import ToastrService from "../../../services/toastr.service";

class VoidJobConfirmationDialogController implements angular.IController {
    static $inject = [
        "$mdDialog",
        "$scope",
        "DispatchData",
        "toastrService",
        "job"
    ];

    voidReasonText?: string;
    voidSingleJobOnly: boolean = true;
    relatedJobs: IMultiSuggestion[] = [];
    isLoadingRelatedJobs: boolean = false;

    constructor(
        private $mdDialog: angular.material.IDialogService,
        private $scope: angular.IScope,
        private DispatchData: DispatchCoreService,
        private toastrService: ToastrService,
        public job: IDispatchJob
    ) {
    }

    $onInit() {
    }

    async onToggleMultiVoid(): Promise<void> {
        if (!this.voidSingleJobOnly && this.relatedJobs.length === 0) {
            await this.loadRelatedJobs();
        }
    }

    toggleJobSelection(job: IMultiSuggestion): void {
        job.selected = !job.selected;
    }

    selectAllJobs(): void {
        this.relatedJobs.forEach(job => job.selected = true);
    }

    deselectAllJobs(): void {
        this.relatedJobs.forEach(job => job.selected = false);
    }

    getSelectedJobIds(): number[] {
        return this.relatedJobs
            .filter(job => job.selected)
            .map(job => job.id);
    }

    getSelectedJobCount(): number {
        return this.relatedJobs.filter(job => job.selected).length;
    }

    async confirm(): Promise<void> {
        try {
            if (!this.voidReasonText || this.voidReasonText.trim() === '') {
                this.toastrService.showWarningToast('Please enter a reason for voiding this job.');
                return;
            }

            const selectedJobIds = this.voidSingleJobOnly ? undefined : this.getSelectedJobIds();

            if (!this.voidSingleJobOnly && (!selectedJobIds || selectedJobIds.length === 0)) {
                this.toastrService.showWarningToast('Please select at least one job to void.');
                return;
            }

            if (this.job.isBulkJob) {
                await this.DispatchData.voidBulkJob(
                    this.job.id,
                    this.voidSingleJobOnly,
                    this.voidReasonText,
                    selectedJobIds
                );
            } else {
                await this.DispatchData.voidJob(
                    this.job.id,
                    this.voidSingleJobOnly,
                    this.voidReasonText,
                    selectedJobIds
                );
            }

            const voidedCount = this.voidSingleJobOnly ? 1 : selectedJobIds?.length ?? 1;
            const message = voidedCount === 1
                ? `${this.job.jobNo} has been voided successfully.`
                : `${voidedCount} jobs have been voided successfully.`;

            this.toastrService.showSuccessToast(message);
            this.$mdDialog.hide();
        } catch (error) {
            this.toastrService.showErrorToast("An error occurred while voiding the job. Please try again later.");
        }
    }

    private async loadRelatedJobs(): Promise<void> {
        this.isLoadingRelatedJobs = true;

        try {
            this.relatedJobs = await this.DispatchData.getRelatedJobsMultiSelectList(
                this.job.id,
                this.job.isArchived ?? false
            );
        } catch (error) {
            console.error("Error loading related jobs:", error);
            this.toastrService.showErrorToast("Failed to load related jobs.");
            this.relatedJobs = [];
        } finally {
            this.isLoadingRelatedJobs = false;
            this.$scope.$applyAsync();
        }
    }

    cancel(): void {
        this.$mdDialog.cancel();
    }
}

export default VoidJobConfirmationDialogController;