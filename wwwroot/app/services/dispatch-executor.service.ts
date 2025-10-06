import {IDispatchJob, IJobQueryParams} from "../interfaces/job.interface";
import {ActiveCourierViewModel} from "../interfaces/courier.interface";
import {JobListResponse} from "../interfaces/job-list-response.interface";
import DispatchCoreService from "./dispatch-core.service";
import ToastrService from "./toastr.service";
import {ContactID} from "../contants";
import dayjs from "dayjs";

class DispatchExecutorService implements angular.IServiceProvider {
    static $inject = [
        "$mdDialog",
        "DispatchData",
        "$document",
        "toastrService"
    ];

    private pickCouriers: ActiveCourierViewModel[] = [];
    private pickAllCouriers: ActiveCourierViewModel[] = [];
    
    private dispatchState = {
        processing: false,
        selectedJobs: new Set<number>()
    };

    constructor(
        private $mdDialog: angular.material.IDialogService,
        private DispatchData: DispatchCoreService,
        private $document: angular.IDocumentService,
        private toastrService: ToastrService,
    ) {
        console.debug("DispatchExecutorService initialized");
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

            // Validate courier number
            const courier = await this.DispatchData.getCourierById(courierId);
            if (!courier) {
                console.error("Invalid courierId");
            }

            // Perform dispatch operation
            await this.dispatchJobsByCourierId(courierId, jobsToDispatch);

            // Clear selection state
            this.dispatchState.selectedJobs.clear();
        } catch (error: any) {
            console.error("Error dispatching jobs:", error);
            throw error;
        } finally {
            this.dispatchState.processing = false;
        }
    }
    
    async fetchCouriersData(): Promise<void> {
        console.debug("Fetching couriers data...");
        try {
            const [activeCouriers, allCouriers] = await Promise.all([
                this.DispatchData.getActiveCouriers(),
                this.DispatchData.getAllCouriers()
            ]);

            this.pickCouriers = activeCouriers;
            this.pickAllCouriers = allCouriers;

            console.debug("Couriers data fetched:", {
                activeCouriers: this.pickCouriers.length,
                allCouriers: this.pickAllCouriers.length
            });
        } catch (error) {
            console.error("Error fetching couriers data:", error);
            throw error;
        }
    }

    async getJobListWithCourierData(
        queryParams: IJobQueryParams,
        selectedClients: Array<any>,
        isInternal: boolean,
        selectedAreas: Array<any>,
        selectedClearListId?: number,
    ): Promise<JobListResponse> {
        console.debug("Getting job list with courier data:", {
            queryParams,
            clientCount: selectedClients?.length,
            isInternal,
            selectedAreas,
            dateCutoff: queryParams.endDate,
            startDate: queryParams.startDate,
            endDate: queryParams.endDate
        });

        try {
            await this.fetchCouriersData();

            const params = {
                ...queryParams,
                // Make sure we're not accidentally setting undefined parameters
                dateCutoff: queryParams.endDate || undefined,
                startDate: queryParams.startDate || undefined,
                endDate: queryParams.endDate || undefined
            };
            
            let result;
            if(selectedClearListId) {
                result =  await this.DispatchData.getClearListJobs(
                    params,
                    selectedClients,
                    isInternal,
                    selectedAreas,
                    selectedClearListId
                );
            } else {
                result = await this.DispatchData.getJobsWithFilters(
                    params,
                    selectedClients,
                    isInternal,
                    selectedAreas
                );
            }

            // Get unDispatched jobs (safely handle null courierData)
            const unDispatchedJobs = result.filter((job: IDispatchJob) =>
                !job?.courierData?.courierId
            );

            console.debug(`Retrieved ${result.length} jobs, ${unDispatchedJobs.length} unDispatched`);

            return {
                items: result,
                undispatchedJobs: unDispatchedJobs,
                activeCouriers: this.pickCouriers,
                allCouriers: this.pickAllCouriers
            };
        } catch (error) {
            console.error("Error in getJobListWithCourierData:", error);
            throw error;
        }
    }

    async dispatchJobByJobId(courierId: number, jobId: number): Promise<void> {
        console.debug("Dispatching job by ID:", {courierId, jobId});
        try {
            const job = await this.DispatchData.getDispatchJobDetail(jobId);
            console.debug("Job details fetched:", job);

            const foundCourier = await this.DispatchData.getCourierById(courierId);
            console.debug("Found courier:", foundCourier);

            if (!foundCourier) {
                await this.$mdDialog.show(
                    this.$mdDialog.alert()
                        .title("Unable to Restore")
                        .textContent(`This courier was not found. Unable to restore job`)
                        .ok("Understood")
                );
                
                console.error(`Courier with ID ${courierId} not found. Unable to restore job`);
                return;
            }

            await this.dispatchJob(foundCourier.courierId, job as IDispatchJob);
        } catch (error) {
            console.error("Error in dispatchJobByJobId:", error);
            throw error;
        }
    }

    async dispatchJobsByCourierId(courierId: number, jobs: IDispatchJob[]): Promise<any> {
        console.debug("Dispatching multiple jobs by courier ID:", {courierId, jobCount: jobs.length});
        try {
            const courier = await this.DispatchData.getCourierById(courierId);
            console.debug("Found courier:", courier);

            if (courier) {
                await this.dispatchJobsContinue(courier, jobs);
            } else {
                console.warn(`Could not find courier with ID ${courierId}`);
            }
        } catch (error) {
            console.error("Error in dispatchJobsByCourierId:", error);
            throw error;
        }
    }

    async dispatchJob(courierNumber: number, job: IDispatchJob): Promise<any> {
        await this.fetchCouriersData();
        const foundCourier = await this.findCourierByNumber(courierNumber);

        if (foundCourier) {
            await this.dispatchJobsContinue(foundCourier, [job]);
        }
    }

    async reallocateJob(job: IDispatchJob) {
        const callData = {
            call: "redespatchJobs",
            jobs: [] as number[],
            splitJobs: [] as number[],
            jobNos: [] as string[],
            courierId: null,
        };

        callData.jobs.push(job.id);

        if (!job.courierData?.courierId) return;
        const foundCourier = await this.DispatchData.getCourierById(job.courierData?.courierId);

        if (callData.jobs.length > 0) {
            await this.DispatchData.reAllocateJobs(foundCourier.courierId, callData.jobs);
            this.toastrService.showSuccessToast("Jobs reallocated successfully");
        }

        return {gpsCourier: foundCourier.id};
    }

    async restoreJob(job: IDispatchJob): Promise<{ gpsCourier: number | undefined }> {
        console.debug(`[restoreJob] Starting restoration for job #${job.jobNo}`);

        const validationResult = await this.validateJobForRestore(job);
        console.debug(`[restoreJob] Validation result for job #${job.jobNo}:`,
            {isValid: validationResult.isValid, courierId: validationResult.courier?.id});

        if (!validationResult.isValid) {
            console.debug(`[restoreJob] Job #${job.jobNo} failed validation, not restoring`);
            return {gpsCourier: undefined};
        }

        try {
            if (!validationResult.courier) {
                console.error(`[restoreJob] Courier not found for job #${job.jobNo}`);
                return {gpsCourier: undefined};
            }

            console.debug(`[restoreJob] Processing restore for job #${job.jobNo} with courier ID ${validationResult.courier.id}`);
            const restoredJob = await this.processJobRestore(job, validationResult.courier);
            console.debug(`[restoreJob] Successfully restored job #${job.jobNo}, assigned to courier ID ${restoredJob.courierId}`);

            return {gpsCourier: restoredJob.courierId};
        } catch (error: any) {
            console.error(`[restoreJob] Error restoring job #${job.jobNo}:`, error);
            await this.showAlertMessage(`Failed to restore job #${job.jobNo}. Error occured ${error.message}`);
            return {gpsCourier: undefined};
        }
    }

    private async findCourierByNumber(courierNumber: number): Promise<ActiveCourierViewModel | null> {
        if (!courierNumber || courierNumber <= 0) {
            throw new Error('Invalid courier number');
        }

        await this.fetchCouriersData();

        const findCourierById = (couriers: ActiveCourierViewModel[], id: number): ActiveCourierViewModel | null =>
            couriers.find(c => c.courierId === id) || null;

        // First, try to find among active couriers
        const activeCourier = findCourierById(this.pickCouriers, courierNumber);
        if (activeCourier) {
            return activeCourier;
        }

        const confirmed = await this.showOfflineCourierDialog();
        if (confirmed) {
            return findCourierById(this.pickAllCouriers, courierNumber);
        }

        return null;
    }

    private showOfflineCourierDialog() {
        return this.$mdDialog.show(
            this.$mdDialog.confirm()
                .title("Courier Offline")
                .textContent("Dispatch anyway?")
                .ok("Yes")
                .cancel("No")
        );
    }

    private async dispatchJobsContinue(courier: ActiveCourierViewModel, jobs: IDispatchJob[]): Promise<void> {
        const validationResults = await Promise.all(
            jobs.map(job => this.validateJob(job, courier))
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
            await this.showAlertMessage(errorMessages.join("\n"));
            if (validJobs.length === 0) {
                return;
            }
        }

        await this.processValidJobs(courier, validJobs);
    }

    private requiresFollowupEvent(job: IDispatchJob): boolean {
        return job.dgClass !== undefined && job.dgClass > 0;
    }

    private async validateJob(job: IDispatchJob, courier: ActiveCourierViewModel): Promise<{
        isValid: boolean;
        message: string;
    }> {
        console.debug("Validating job:", {
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

        console.debug("Job validation passed:", job.jobNo);
        return {isValid: true, message: ""};
    }

    private async processValidJobs(courier: ActiveCourierViewModel, jobs: IDispatchJob[]): Promise<void> {
        const LOG_MESSAGES = {
            PROCESSING_JOBS: "Processing valid jobs",
            FOLLOWUP_JOBS: "Jobs requiring followup",
            PROCESSING_FOLLOWUP: "Processing followup events",
            ALLOCATING_JOBS: "Allocating jobs",
            SUCCESS: "Jobs processed successfully",
            ERROR: "Failed to dispatch jobs"
        };

        if (!courier || !jobs?.length) {
            throw new Error("Invalid courier or jobs data");
        }

        const logJobStatus = (message: string, data?: object) => {
            console.debug(message, data);
        };

        try {
            logJobStatus(LOG_MESSAGES.PROCESSING_JOBS, {
                courierId: courier.courierId,
                jobCount: jobs.length
            });

            await this.processFollowupJobs(jobs);
            await this.allocateJobsToCourier(courier, jobs);

            logJobStatus(LOG_MESSAGES.SUCCESS);
        } catch (error: any) {
            await this.handleDispatchError(error);
        }
    }

    private async processFollowupJobs(jobs: IDispatchJob[]): Promise<void> {
        const jobsRequiringFollowup = jobs.filter(this.requiresFollowupEvent);
        console.debug("Jobs requiring followup:", jobsRequiringFollowup.length);

        if (jobsRequiringFollowup.length > 0) {
            console.debug("Processing followup events");
            await Promise.all(
                jobsRequiringFollowup.map(job => this.DispatchData.addFollowupEvent(job.id))
            );
        }
    }

    private async allocateJobsToCourier(courier: ActiveCourierViewModel, jobs: IDispatchJob[]): Promise<void> {
        const jobIds = jobs.map(job => job.id);
        console.debug("Allocating jobs:", jobIds.length);
        await this.DispatchData.allocateJobs(courier.courierId, jobIds);
    }

    private async handleDispatchError(error: Error): Promise<never> {
        console.error("Error processing valid jobs:", error);
        await this.showAlertMessage(`Failed to dispatch jobs: ${error.message}`);
        throw error;
    }

    private async validateJobForRestore(job: IDispatchJob): Promise<{
        isValid: boolean;
        courier?: ActiveCourierViewModel
    }> {
        const courierId = job?.assignedCourier?.id;
        if (!courierId) {
            await this.$mdDialog.show(
                this.$mdDialog.alert()
                    .title("Unable to Restore")
                    .textContent("Job has no assigned courier to restore from. Unable to restore")
                    .ok("Understood")
            );

            return {isValid: false};
        }

        const courier = await this.DispatchData.getCourierById(courierId);
        if (!courier) {
            await this.$mdDialog.show(
                this.$mdDialog.alert()
                    .title("Unable to Restore")
                    .textContent("The assigned courier could not found. Unable to restore")
                    .ok("Understood")
            );
            
            return {isValid: false};
        }

        return {isValid: true, courier};
    }

    private async processJobRestore(job: IDispatchJob, courier: ActiveCourierViewModel) {
        console.debug(`[_processJobRestore] Starting restore process for job #${job.jobNo} with ID ${job.id}`);

        try {
            console.debug(`[_processJobRestore] Adding restore event for job ID ${job.id}`);
            await this.DispatchData.addRestoreEvent(job.id);

            if (job.displaySplitJobDetail) {
                console.debug(`[_processJobRestore] Job #${job.jobNo} is a split job, restoring all split jobs`);
                await this.DispatchData.restoreSplitJobs([job.id]);
            } else {
                console.debug(`[_processJobRestore] Job #${job.jobNo} is a standard job, restoring`);
                await this.DispatchData.restoreJobs([job.id]);
            }

            console.debug(`[_processJobRestore] Successfully completed restore process for job #${job.jobNo}, courier ID: ${courier.id}`);
            return courier;
        } catch (error) {
            console.error(`[_processJobRestore] Error during restore process for job #${job.jobNo}:`, error);
            throw error;
        }
    }

    private async showAlertMessage(textContent: string) {
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
