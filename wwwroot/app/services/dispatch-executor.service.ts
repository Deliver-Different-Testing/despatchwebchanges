import {IDispatchJob, IJobQueryParams, IJobSearchResult} from "../interfaces/job.interface";
import {ActiveCourierViewModel} from "../interfaces/courier.interface";
import DispatchCoreService from "./dispatch-core.service";
import dayjs from "dayjs";
import {DfrntPageViewModel} from "../interfaces/dfrnt-page-view-model.interface";
import {DispatchState, ValidationResult} from "../interfaces/dispatch-executor-service.interfaces";

class DispatchExecutorService implements angular.IServiceProvider {
    static $inject = [
        "$mdDialog",
        "DispatchData",
        "$document",
    ];
    
    private dispatchState: DispatchState = {
        processing: false,
        selectedJobs: new Set<number>()
    };

    constructor(
        private $mdDialog: angular.material.IDialogService,
        private DispatchData: DispatchCoreService,
        private $document: angular.IDocumentService,
    ) {}

    $get() {
        return this;
    }

    // ============================================
    // Public API Methods
    // ============================================

    async dispatchJobs(courierId: number, jobsToDispatch: IDispatchJob[]): Promise<void> {
        if (this.dispatchState.processing) {
            console.warn("Dispatch already in progress");
            return;
        }

        if (!jobsToDispatch.length) {
            console.warn("No jobs selected for dispatch");
            return;
        }

        try {
            this.dispatchState.processing = true;
            await this.validateAndDispatch(courierId, jobsToDispatch);
        } catch (error: any) {
            console.error("Error dispatching jobs:", error);
            throw error;
        } finally {
            this.dispatchState.processing = false;
            this.dispatchState.selectedJobs.clear();
        }
    }

    async getJobsWithDispatchInfo(
        queryParams: IJobQueryParams,
        isInternal: boolean,
        selectedAreas: DfrntPageViewModel[],
        selectedClearListId?: number,
    ): Promise<IJobSearchResult> {
        try {
            return await this.fetchJobsByParameters(
                queryParams,
                isInternal,
                selectedAreas,
                selectedClearListId
            );
        } catch (error) {
            console.error("Error fetching jobs with dispatch status:", error);
            throw error;
        }
    }

    async assignSingleJobById(courierId: number, jobId: number): Promise<void> {
        console.log("Dispatching job by ID:", {courierId, jobId});

        this.validateDispatchParams(courierId, jobId);

        try {
            const [job, courier] = await Promise.all([
                this.DispatchData.getDispatchJobDetail(jobId),
                this.DispatchData.getCourierById(courierId)
            ]);

            console.log("Job details fetched:", job);
            console.log("Found courier:", courier);

            if (!courier) {
                await this.showCourierNotFoundDialog(courierId);
                return;
            }

            await this.assignSingleJobToCourier(courier.courierId, job as IDispatchJob);
        } catch (error) {
            console.error("Error in assignSingleJobById:", error);
            throw error;
        }
    }

    async assignJobsToCourier(courierId: number, jobs: IDispatchJob[]): Promise<void> {
        console.log("Dispatching multiple jobs by courier ID:", {courierId, jobCount: jobs.length});

        try {
            const courier = await this.DispatchData.getCourierById(courierId);
            console.log("Found courier:", courier);

            if (!courier) {
                console.warn(`Could not find courier with ID ${courierId}`);
                return;
            }

            await this.executeJobDispatch(courier, jobs);
        } catch (error) {
            console.error("Error in assignJobsToCourier:", error);
            throw error;
        }
    }

    async reassignJob(job: IDispatchJob): Promise<void> {
        try {
            const selectedCourier = await this.showCourierSelectionDialog(job);

            if (!selectedCourier) {
                console.log("No courier selected for reallocation");
                return;
            }

            const newCourierNumber = selectedCourier.courier.courierId;
            console.log(`Reallocating job ${job.jobNo} to courier ${newCourierNumber}`);

            await this.assignSingleJobToCourier(newCourierNumber, job);
        } catch (error) {
            console.error("Error during job reallocation:", error);
            throw error;
        }
    }

    // ============================================
    // Private Helper Methods
    // ============================================

    private validateDispatchParams(courierId: number, jobId: number): void {
        if (!jobId) {
            throw new Error("No job ID provided");
        }

        if (!courierId) {
            throw new Error("No courier ID provided");
        }
    }

    private async validateAndDispatch(courierId: number, jobs: IDispatchJob[]): Promise<void> {
        const courier = await this.DispatchData.getCourierById(courierId);

        if (!courier) {
            throw new Error(`Invalid courier ID: ${courierId}`);
        }

        await this.assignJobsToCourier(courierId, jobs);
    }

    private async fetchJobsByParameters(
        queryParams: IJobQueryParams,
        isInternal: boolean,
        selectedAreas: DfrntPageViewModel[],
        selectedClearListId?: number,
    ): Promise<IJobSearchResult> {
        if (selectedClearListId) {
            return this.DispatchData.getClearListJobs(
                queryParams,
                isInternal,
                selectedAreas,
                selectedClearListId
            );
        }

        return this.DispatchData.getJobsWithFilters(
            queryParams,
            isInternal,
            selectedAreas
        );
    }

    async assignSingleJobToCourier(courierId: number, job: IDispatchJob): Promise<void> {
        const courier = await this.findCourierWithConfirmation(courierId);

        if (!courier) {
            console.warn(`Dispatch cancelled - no courier found for courier number ${courierId}`);
            return;
        }

        await this.executeJobDispatch(courier, [job]);
    }

    private async findCourierWithConfirmation(courierId: number): Promise<ActiveCourierViewModel | null> {
        if (!courierId || courierId <= 0) {
            throw new Error('Invalid courier number');
        }
        
        // Try active couriers first
        const activeCourier = await this.DispatchData.getCourierById(courierId);
        if (activeCourier) {
            return activeCourier;
        }

        // Handle offline courier confirmation
        return await this.handleOfflineCourierConfirmation(courierId);
    }
    
    private async handleOfflineCourierConfirmation(courierId: number): Promise<ActiveCourierViewModel | null> {
        try {
            const shouldDispatch = await this.$mdDialog.show(
                this.$mdDialog.confirm()
                    .title("Courier Offline")
                    .textContent("Dispatch anyway?")
                    .ok("Yes")
                    .cancel("No")
            );

            if (shouldDispatch) {
                return await this.DispatchData.getCourierById(courierId);
            }
        } catch (error) {
            console.log("Courier offline dispatch cancelled by user");
        }

        return null;
    }

    // ============================================
    // Job Dispatch Execution
    // ============================================

    private async executeJobDispatch(courier: ActiveCourierViewModel, jobs: IDispatchJob[]): Promise<void> {
        const {validJobs, errorMessages} = await this.validateJobs(jobs, courier);

        if (errorMessages.length > 0) {
            await this.displayErrorAlert(errorMessages.join("\n"));

            if (validJobs.length === 0) {
                return;
            }
        }

        await this.performJobDispatch(courier, validJobs);
    }

    private async validateJobs(jobs: IDispatchJob[], courier: ActiveCourierViewModel): Promise<{
        validJobs: IDispatchJob[];
        errorMessages: string[];
    }> {
        const validationResults = await Promise.all(
            jobs.map(job => this.validateJobForDispatch(job, courier))
        );

        const validJobs: IDispatchJob[] = [];
        const errorMessages: string[] = [];

        jobs.forEach((job, index) => {
            if (validationResults[index].isValid) {
                validJobs.push(job);
            } else {
                errorMessages.push(validationResults[index].message);
            }
        });

        return {validJobs, errorMessages};
    }

    private async validateJobForDispatch(job: IDispatchJob, courier: ActiveCourierViewModel): Promise<ValidationResult> {
        console.log("Validating job:", {
            jobNo: job?.jobNo,
            courierId: courier?.id,
            hasDG: this.isDangerousGoodsJob(job),
            hasExistingCourier: !!job.courierData?.courierId
        });

        // Check if the job already has a courier
        if (job.courierData?.courierId) {
            const message = `Restore ${job.jobNo} prior to dispatching to another courier`;
            console.warn("Job validation failed:", message);
            return {isValid: false, message};
        }

        // Validate dangerous goods requirements
        if (this.isDangerousGoodsJob(job)) {
            const dgValidation = this.validateDangerousGoodsJob(job, courier);
            if (!dgValidation.isValid) {
                console.warn("Job validation failed:", dgValidation.message);
                return dgValidation;
            }
        }

        console.log("Job validation passed:", job.jobNo);
        return {isValid: true, message: ""};
    }

    private validateDangerousGoodsJob(job: IDispatchJob, courier: ActiveCourierViewModel): ValidationResult {
        if (!courier.dangerousGoods) {
            return {
                isValid: false,
                message: `DG job ${job.jobNo} cannot be dispatched to courier ${courier.id} - doesn't have DG License.`
            };
        }

        if (dayjs(courier.dgLicenseExpiry) < dayjs().add(1, "days")) {
            return {
                isValid: false,
                message: `Courier ${courier.id} doesn't have a DG License or license has expired.`
            };
        }

        return {isValid: true, message: ""};
    }

    private isDangerousGoodsJob(job: IDispatchJob): boolean {
        return job.dgClass !== null && job.dgClass !== undefined && job.dgClass > 0;
    }

    private async performJobDispatch(courier: ActiveCourierViewModel, jobs: IDispatchJob[]): Promise<void> {
        if (!courier || !jobs?.length) {
            throw new Error("Invalid courier or jobs data");
        }

        try {
            console.log("Processing valid jobs", {
                courierId: courier.courierId,
                jobCount: jobs.length
            });

            await this.createFollowupEventsForDangerousGoods(jobs);
            await this.allocateJobsToSelectedCourier(courier, jobs);

            console.log("Jobs processed successfully");
        } catch (error: any) {
            await this.handleDispatchFailure(error);
        }
    }

    private async createFollowupEventsForDangerousGoods(jobs: IDispatchJob[]): Promise<void> {
        const dangerousGoodsJobs = jobs.filter(job => this.isDangerousGoodsJob(job));
        console.log("Jobs requiring followup:", dangerousGoodsJobs.length);

        if (dangerousGoodsJobs.length > 0) {
            console.log("Processing followup events");
            await Promise.all(
                dangerousGoodsJobs.map(job => this.DispatchData.addFollowupEvent(job.id))
            );
        }
    }

    private async allocateJobsToSelectedCourier(courier: ActiveCourierViewModel, jobs: IDispatchJob[]): Promise<void> {
        const jobIds = jobs.map(job => job.id);
        console.log("Allocating jobs:", jobIds.length);
        await this.DispatchData.allocateJobs(courier.courierId, jobIds);
    }

    private async handleDispatchFailure(error: Error): Promise<never> {
        console.error("Error processing valid jobs:", error);
        await this.displayErrorAlert(`Failed to dispatch jobs: ${error.message}`);
        throw error;
    }

    // ============================================
    // UI Dialog Methods
    // ============================================

    private async showCourierNotFoundDialog(courierId: number): Promise<void> {
        await this.$mdDialog.show(
            this.$mdDialog.alert()
                .title("Unable to Restore")
                .textContent(`This courier was not found. Unable to restore job`)
                .ok("Understood")
        );

        console.error(`Courier with ID ${courierId} not found. Unable to restore job`);
    }

    private async showCourierSelectionDialog(job: IDispatchJob): Promise<any> {
        const jobInfo = {
            title: job.jobNo,
            textContent: "Select a courier to reallocate to",
            ariaLabel: "Select a courier",
            targetEvent: null,
            clickOutsideToClose: true
        };

        return this.$mdDialog.show({
            controller: 'SelectCourierController',
            controllerAs: 'vm',
            template: this.getCourierSelectionTemplate(),
            parent: angular.element(document.body),
            locals: jobInfo
        });
    }

    private getCourierSelectionTemplate(): string {
        return `
            <md-dialog aria-label="Select Courier">
                <md-dialog-content>
                    <h2>Select a Courier</h2>
                    <!-- Dialog content here -->
                </md-dialog-content>
            </md-dialog>
        `;
    }

    private async displayErrorAlert(textContent: string): Promise<void> {
        const alert = this.$mdDialog.alert()
            .parent(this.$document.parent())
            .clickOutsideToClose(true)
            .title("Unable to Despatch")
            .textContent(textContent)
            .ariaLabel("unable to despatch")
            .ok("OK");

        await this.$mdDialog.show(alert);
    }
}

export default DispatchExecutorService;