import {IDispatchJob, IJobQueryParams, IJobSearchResult} from "../interfaces/job.interface";
import {ActiveCourierViewModel} from "../interfaces/courier.interface";
import DispatchCoreService from "./dispatch-core.service";
import dayjs from "dayjs";
import {DfrntPageViewModel} from "../interfaces/dfrnt-page-view-model.interface";

class DispatchExecutorService implements angular.IServiceProvider {
    static $inject = [
        "$mdDialog",
        "DispatchData",
        "$document",
    ];

    private activeCouriers: ActiveCourierViewModel[] = [];
    private allCouriers: ActiveCourierViewModel[] = [];

    private dispatchState = {
        processing: false,
        selectedJobs: new Set<number>()
    };

    constructor(
        private $mdDialog: angular.material.IDialogService,
        private DispatchData: DispatchCoreService,
        private $document: angular.IDocumentService,
    ) {
    }

    $get() {
        return this;
    }

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

            // Validate courier exists
            const courier = await this.DispatchData.getCourierById(courierId);
            if (!courier) {
                console.error("Invalid courierId");
            }

            // Perform dispatch operation
            await this.assignJobsToCourier(courierId, jobsToDispatch);

            // Clear selection state
            this.dispatchState.selectedJobs.clear();
        } catch (error: any) {
            console.error("Error dispatching jobs:", error);
            throw error;
        } finally {
            this.dispatchState.processing = false;
        }
    }

    async loadCourierData(): Promise<void> {
        console.log("Fetching couriers data...");
        try {
            const [activeCouriers, allCouriers] = await Promise.all([
                this.DispatchData.getActiveCouriers(),
                this.DispatchData.getAllCouriers()
            ]);

            this.activeCouriers = activeCouriers;
            this.allCouriers = allCouriers;

            console.log("Couriers data fetched:", {
                activeCouriers: this.activeCouriers.length,
                allCouriers: this.allCouriers.length
            });
        } catch (error) {
            console.error("Error fetching couriers data:", error);
            throw error;
        }
    }

    async getJobsWithDispatchInfo(
        queryParams: IJobQueryParams,
        isInternal: boolean,
        selectedAreas: DfrntPageViewModel[],
        selectedClearListId?: number,
    ): Promise<IJobSearchResult> {
        try {
            await this.loadCourierData();
   
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

    private async fetchJobsByParameters(
        queryParams: IJobQueryParams,
        isInternal: boolean,
        selectedAreas: Array<any>,
        selectedClearListId?: number,
    ): Promise<IJobSearchResult> {
        const cleanedParams = this.cleanQueryParameters(queryParams);

        if (selectedClearListId) {
            return this.DispatchData.getClearListJobs(
                cleanedParams,
                isInternal,
                selectedAreas,
                selectedClearListId
            );
        }

        return this.DispatchData.getJobsWithFilters(
            cleanedParams,
            isInternal,
            selectedAreas
        );
    }

    private cleanQueryParameters(params: IJobQueryParams): IJobQueryParams {
        return {
            ...params,
            startDate: params.startDate || undefined,
            endDate: params.endDate || undefined
        };
    }
    
    async assignSingleJobById(courierId: number, jobId: number): Promise<void> {
        console.log("Dispatching job by ID:", {courierId, jobId});
        try {
            if(!jobId) {
                console.warn("No job ID provided");
                return;
            }
            
            if(!courierId) {
                console.warn("No courier ID provided");
                return;
            }
            
            const job = await this.DispatchData.getDispatchJobDetail(jobId);
            console.log("Job details fetched:", job);

            const courier = await this.DispatchData.getCourierById(courierId);
            console.log("Found courier:", courier);

            if (!courier) {
                await this.$mdDialog.show(
                    this.$mdDialog.alert()
                        .title("Unable to Restore")
                        .textContent(`This courier was not found. Unable to restore job`)
                        .ok("Understood")
                );

                console.error(`Courier with ID ${courierId} not found. Unable to restore job`);
                return;
            }

            await this.assignSingleJobToCourier(courier.courierId, job as IDispatchJob);
        } catch (error) {
            console.error("Error in assignSingleJobById:", error);
            throw error;
        }
    }

    async assignJobsToCourier(courierId: number, jobs: IDispatchJob[]): Promise<any> {
        console.log("Dispatching multiple jobs by courier ID:", {courierId, jobCount: jobs.length});
        try {
            const courier = await this.DispatchData.getCourierById(courierId);
            console.log("Found courier:", courier);

            if (courier) {
                await this.executeJobDispatch(courier, jobs);
            } else {
                console.warn(`Could not find courier with ID ${courierId}`);
            }
        } catch (error) {
            console.error("Error in assignJobsToCourier:", error);
            throw error;
        }
    }

    async assignSingleJobToCourier(courierNumber: number, job: IDispatchJob): Promise<any> {
        await this.loadCourierData();
        const courier = await this.findCourierWithConfirmation(courierNumber);

        if (courier) {
            await this.executeJobDispatch(courier, [job]);
        } else {
            console.warn(`Dispatch cancelled - no courier found for courier number ${courierNumber}`);
        }
    }

    async reassignJob(job: IDispatchJob) {
        const jobInfo = {
            title: job.jobNo,
            textContent: "Select a courier to reallocate to",
            ariaLabel: "Select a courier",
            targetEvent: null,
            clickOutsideToClose: true
        };

        try {
            const selectedCourier = await this.$mdDialog.show({
                controller: 'SelectCourierController',
                controllerAs: 'vm',
                template: this.getCourierSelectionTemplate(),
                parent: angular.element(document.body),
                locals: jobInfo
            });

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

    private async findCourierWithConfirmation(courierNumber: number): Promise<ActiveCourierViewModel | null> {
        if (!courierNumber || courierNumber <= 0) {
            throw new Error('Invalid courier number');
        }

        await this.loadCourierData();

        const findById = (couriers: ActiveCourierViewModel[], id: number): ActiveCourierViewModel | null =>
            couriers.find(c => c.courierId === id) || null;

        // First, try to find among active couriers
        const activeCourier = findById(this.activeCouriers, courierNumber);
        if (activeCourier) {
            return activeCourier;
        }

        // Courier is offline - ask for confirmation
        const shouldDispatchToOfflineCourier = await this.$mdDialog.show(
            this.$mdDialog.confirm()
                .title("Courier Offline")
                .textContent("Dispatch anyway?")
                .ok("Yes")
                .cancel("No")
        );

        if (shouldDispatchToOfflineCourier) {
            return findById(this.allCouriers, courierNumber);
        }

        return null;
    }

    private async executeJobDispatch(courier: ActiveCourierViewModel, jobs: IDispatchJob[]): Promise<void> {
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

        if (errorMessages.length > 0) {
            await this.displayErrorAlert(errorMessages.join("\n"));
            if (validJobs.length === 0) {
                return;
            }
        }

        await this.executeValidatedJobDispatch(courier, validJobs);
    }

    private isDangerousGoodsJob(job: IDispatchJob): boolean {
        return job.dgClass !== undefined && job.dgClass > 0;
    }

    private async validateJobForDispatch(job: IDispatchJob, courier: ActiveCourierViewModel): Promise<{
        isValid: boolean;
        message: string;
    }> {
        console.log("Validating job:", {
            jobNo: job?.jobNo,
            courierId: courier?.id,
            hasDG: job.dgClass !== undefined && job.dgClass > 0,
            hasExistingCourier: !!job.courierData?.courierId
        });

        if (job.courierData?.courierId) {
            const message = `Restore ${job.jobNo} prior to dispatching to another courier`;
            console.warn("Job validation failed:", message);
            return {isValid: false, message};
        }

        if (job.dgClass !== null && job.dgClass !== undefined && job.dgClass > 0) {
            if (!courier.dangerousGoods) {
                const message = `DG job ${job.jobNo} can not be dispatched to courier ${courier.id} - doesn't have DGLicense.`;
                console.warn("Job validation failed:", message);
                return {isValid: false, message};
            }

            if (dayjs(courier.dgLicenseExpiry) < dayjs().add(1, "days")) {
                const message = `Courier ${courier.id} doesn't have a DGLicense or license has expired.`;
                console.warn("Job validation failed:", message);
                return {isValid: false, message};
            }
        }

        console.log("Job validation passed:", job.jobNo);
        return {isValid: true, message: ""};
    }

    private async executeValidatedJobDispatch(courier: ActiveCourierViewModel, jobs: IDispatchJob[]): Promise<void> {
        const LOG_MESSAGES = {
            PROCESSING_JOBS: "Processing valid jobs",
            SUCCESS: "Jobs processed successfully",
            ERROR: "Failed to dispatch jobs"
        };

        if (!courier || !jobs?.length) {
            throw new Error("Invalid courier or jobs data");
        }

        try {
            console.log(LOG_MESSAGES.PROCESSING_JOBS, {
                courierId: courier.courierId,
                jobCount: jobs.length
            });

            await this.createFollowupEventsForDangerousGoods(jobs);
            await this.allocateJobsToSelectedCourier(courier, jobs);

            console.log(LOG_MESSAGES.SUCCESS);
        } catch (error: any) {
            await this.handleDispatchFailure(error);
        }
    }

    private async createFollowupEventsForDangerousGoods(jobs: IDispatchJob[]): Promise<void> {
        const dangerousGoodsJobs = jobs.filter(this.isDangerousGoodsJob);
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

    private async displayErrorAlert(textContent: string) {
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