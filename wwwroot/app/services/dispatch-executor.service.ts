import app from "../app";
import angular from "angular";
import {IJob, JobQueryParams} from "../interfaces/job.interface";
import {ActiveCourierViewModel} from "../interfaces/courier.interface";
import {JobListResponse} from "../interfaces/job-list-response.interface";
import DispatchCoreService from "./dispatch-core.service";
import {bindAllMethods} from "../bindAllMethods";

class DispatchExecutorService implements angular.IServiceProvider {
    static $inject = ["$mdDialog", "DispatchData", "moment"];

    private pickCouriers: ActiveCourierViewModel[] = [];
    private pickAllCouriers: ActiveCourierViewModel[] = [];

    constructor(private $mdDialog: angular.material.IDialogService,
                private DispatchData: DispatchCoreService,
                private moment: any) {
        bindAllMethods(this);
    }

    $get(): any {
        return this;
    }

    async fetchCouriersData(): Promise<void> {
        console.log("Fetching couriers data...");
        try {
            const [activeCouriers, allCouriers] = await Promise.all([
                this.DispatchData.getActiveCouriers(),
                this.DispatchData.getAllCouriers()
            ]);

            this.pickCouriers = activeCouriers;
            this.pickAllCouriers = allCouriers;

            console.log("Couriers data fetched:", {
                activeCouriers: this.pickCouriers.length,
                allCouriers: this.pickAllCouriers.length
            });
        } catch (error) {
            console.error("Error fetching couriers data:", error);
            throw error;
        }
    }

    async getJobListWithCourierData(
        queryParams: JobQueryParams,
        selectedClients: Array<any>,
        isInternal: boolean,
        selectedAreas: Array<any>
    ): Promise<JobListResponse> {
        console.log("Getting job list with courier data:", {
            queryParams,
            clientCount: selectedClients?.length,
            isInternal,
            selectedAreas
        });

        try {
            await this.fetchCouriersData();

            const result = await this.DispatchData.getJobsWithFilters(
                queryParams,
                selectedClients,
                isInternal,
                selectedAreas
            );

            // Get unDispatched jobs (safely handle null courierData)
            const unDispatchedJobs = result.filter((job: any) =>
                !job?.courierData?.courierId
            );

            console.log(`Retrieved ${result.length} jobs, ${unDispatchedJobs.length} unDispatched`);

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

    async getCurrentJobsForCourier(courierId: number, isDone: boolean = false): Promise<{
        jobs: Array<any>,
        courier: object | null,
        position?: object | null
    }> {
        console.log("Getting current jobs for courier:", courierId);

        try {
            await this.fetchCouriersData();

            // Find courier in both active and all couriers
            const foundCourier = this.pickCouriers.find(c => c?.courierId === courierId) ||
                this.pickAllCouriers.find(c => c?.courierId === courierId);

            console.log("Found courier:", foundCourier);

            if (!foundCourier) {
                console.warn(`No courier found for ID: ${courierId}`);
                return {jobs: [], courier: null};
            }

            // Get jobs data
            const jobs = await this.DispatchData.getJobsCurrent(courierId, isDone);
            console.log(`Retrieved ${jobs.length} jobs for courier`);

            // If no jobs but have courier, get position
            let courierPosition: any;
            if (jobs.length === 0 && foundCourier.id) {
                try {
                    courierPosition = await this.DispatchData.getCourierPosition(foundCourier.id);
                    console.log("Retrieved courier position:", courierPosition);
                } catch (error) {
                    console.warn("Error getting courier position:", error);
                }
            }

            return {
                jobs,
                courier: foundCourier,
                position: courierPosition
            };
        } catch (error) {
            console.error("Error in getCurrentJobsForCourier:", error);
            throw error;
        }
    }

    async dispatchJobByJobId(courierId: number, jobId: number): Promise<void> {
        console.log("Dispatching job by ID:", {courierId, jobId});
        try {
            await this.fetchCouriersData();
            const job = await this.DispatchData.getJobDetail(jobId);
            console.log("Job details fetched:", job);

            const foundCourier = this.pickAllCouriers.find(c => c?.courierId === courierId);
            console.log("Found courier:", foundCourier);

            if (!foundCourier) {
                console.warn(`Could not find courier with ID ${courierId}`);
                await this._showAlertMessage(`Could not find courier with ID ${courierId}`);
                return;
            }

            await this.dispatchJob(foundCourier.courierId, job);
        } catch (error) {
            console.error("Error in dispatchJobByJobId:", error);
            throw error;
        }
    }

    async dispatchJobsByCourierId(courierId: number, jobs: IJob[]): Promise<any> {
        console.log("Dispatching multiple jobs by courier ID:", {courierId, jobCount: jobs.length});
        try {
            await this.fetchCouriersData();
            const foundCourier = this.pickAllCouriers.find(c => c.courierId === courierId);
            console.log("Found courier:", foundCourier);

            if (foundCourier) {
                await this._dispatchJobsContinue(foundCourier, jobs);
            } else {
                console.warn(`Could not find courier with ID ${courierId}`);
            }
        } catch (error) {
            console.error("Error in dispatchJobsBycourierId:", error);
            throw error;
        }
    }

    async dispatchJobs(courierNumber: number, jobs: IJob[]): Promise<any> {
        await this.fetchCouriersData();
        const foundCourier = await this._findCourierByNumber(courierNumber);

        if (foundCourier != null) {
            await this._dispatchJobsContinue(foundCourier, jobs);
        }
    }

    async dispatchJob(courierNumber: number, job: IJob): Promise<any> {
        await this.fetchCouriersData();
        const foundCourier = await this._findCourierByNumber(courierNumber);

        if (foundCourier) {
            await this._dispatchJobsContinue(foundCourier, [job]);
        }
    }

    async dispatchJobsFromPotentialCouriers(courierId: number, jobList: IJob[], contactId: number, firstName: string) {
        await this.fetchCouriersData();

        // Find courier in active couriers list
        const foundCourier = this.pickCouriers.find(c => c?.courierId === courierId);
        if (!foundCourier || !foundCourier.courierId) {
            await this._showAlertMessage(`Could not find active courier with ID ${courierId}`);
            return;
        }

        // Filter and validate jobs
        const validJobs = [];
        const activeJobs = jobList.filter(job => job && job.isActive);

        for (const job of activeJobs) {
            const isValid = await this._validateJob(job, foundCourier);
            if (!job || !isValid) {
                continue;
            }

            validJobs.push(job.id);

            // Handle dangerous goods followup events
            if (this._requiresFollowupEvent(job)) {
                await this.DispatchData.addFollowupEvent(job.id);
            }
        }

        if (validJobs.length === 0) {
            await this._showAlertMessage("No valid jobs to dispatch");
            return;
        }

        try {
            await this.DispatchData.allocateJobs(
                foundCourier.courierId,
                contactId,
                validJobs
            );

            return {
                gpsCourier: foundCourier.id
            };
        } catch (error: any) {
            await this._showAlertMessage(`Failed to dispatch jobs: ${error.message}`);
            throw error;
        }
    }

    private async _findCourierByNumber(courierNumber: number): Promise<ActiveCourierViewModel | null> {
        if (!courierNumber || courierNumber <= 0) {
            throw new Error('Invalid courier number');
        }

        await this.fetchCouriersData();

        const findCourierById = (couriers: ActiveCourierViewModel[], id: number): ActiveCourierViewModel | null =>
            couriers.find(c => c.courierId === id) || null;

        // First try to find among active couriers
        const activeCourier = findCourierById(this.pickCouriers, courierNumber);
        if (activeCourier) {
            return activeCourier;
        }

        const confirmed = await this._showOfflineCourierDialog();
        if (confirmed) {
            return findCourierById(this.pickAllCouriers, courierNumber);
        }

        return null;
    }

    private _showOfflineCourierDialog() {
        return this.$mdDialog.show(
            this.$mdDialog.confirm()
                .title("Courier Offline")
                .textContent("Dispatch anyway?")
                .ok("Yes")
                .cancel("No")
        );
    }

    private async _dispatchJobsContinue(courier: ActiveCourierViewModel, jobs: IJob[]): Promise<void> {
        const validationResults = await Promise.all(
            jobs.map(job => this._validateJob(job, courier))
        );

        const validJobs: IJob[] = [];
        const errorMessages: string[] = [];

        jobs.forEach((job, index) => {
            if (validationResults[index].isValid) {
                validJobs.push(job);
            } else {
                errorMessages.push(validationResults[index].message);
            }
        });

        if (errorMessages.length > 0) {
            await this._showAlertMessage(errorMessages.join("\n"));
            if (validJobs.length === 0) {
                return;
            }
        }

        await this._processValidJobs(courier, validJobs);
    }

    private _requiresFollowupEvent(job: IJob): boolean {
        return job.dgClass !== undefined && job.dgClass > 0;
    }

    private async _validateJob(job: IJob, courier: ActiveCourierViewModel): Promise<{
        isValid: boolean;
        message: string;
    }> {
        console.log("Validating job:", {
            jobNo: job?.jobNo,
            courierId: courier?.id,
            hasDG: job.dgClass !== undefined && job.dgClass > 0
        });

        if (job.courierData !== null) {
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

            if (this.moment(courier.dgLicenseExpiry) < this.moment().add(1, "days")) {
                const message = `Courier ${courier.id} doesn't have a DGLicense or license has expired.`;
                console.warn("Job validation failed:", message);
                return {isValid: false, message};
            }
        }

        console.log("Job validation passed:", job.jobNo);
        return {isValid: true, message: ""};
    }

    private async _processValidJobs(courier: ActiveCourierViewModel, jobs: IJob[]): Promise<void> {
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
            console.log(message, data);
        };

        try {
            logJobStatus(LOG_MESSAGES.PROCESSING_JOBS, {
                courierId: courier.courierId,
                jobCount: jobs.length
            });

            await this._processFollowupJobs(jobs);
            await this._allocateJobsToCourier(courier, jobs);

            logJobStatus(LOG_MESSAGES.SUCCESS);
        } catch (error: any) {
            await this._handleDispatchError(error);
        }
    }

    private async _processFollowupJobs(jobs: IJob[]): Promise<void> {
        const jobsRequiringFollowup = jobs.filter(this._requiresFollowupEvent);
        console.log("Jobs requiring followup:", jobsRequiringFollowup.length);

        if (jobsRequiringFollowup.length > 0) {
            console.log("Processing followup events");
            await Promise.all(
                jobsRequiringFollowup.map(job => this.DispatchData.addFollowupEvent(job.id))
            );
        }
    }

    private async _allocateJobsToCourier(courier: ActiveCourierViewModel, jobs: IJob[]): Promise<void> {
        const jobIds = jobs.map(job => job.id);
        console.log("Allocating jobs:", jobIds.length);
        await this.DispatchData.allocateJobs(courier.courierId, ContactID, jobIds);
    }

    private async _handleDispatchError(error: Error): Promise<never> {
        console.error("Error processing valid jobs:", error);
        await this._showAlertMessage(`Failed to dispatch jobs: ${error.message}`);
        throw error;
    }

    async restoreJob(job: IJob): Promise<{ gpsCourier: number | undefined }> {
        console.log(`[restoreJob] Starting restoration for job #${job.jobNo}`);

        const validationResult = await this._validateJobForRestore(job);
        console.log(`[restoreJob] Validation result for job #${job.jobNo}:`,
            { isValid: validationResult.isValid, courierId: validationResult.courier?.id });

        if (!validationResult.isValid) {
            console.log(`[restoreJob] Job #${job.jobNo} failed validation, not restoring`);
            return { gpsCourier: undefined };
        }

        try {
            if(validationResult.courier == undefined) {
                console.error(`[restoreJob] Courier not found for job #${job.jobNo}`);
                return { gpsCourier: undefined };
            }

            console.log(`[restoreJob] Processing restore for job #${job.jobNo} with courier ID ${validationResult.courier.id}`);
            const restoredJob = await this._processJobRestore(job, validationResult.courier);
            console.log(`[restoreJob] Successfully restored job #${job.jobNo}, assigned to courier ID ${restoredJob.courierId}`);

            return { gpsCourier: restoredJob.courierId };
        } catch (error: any) {
            console.error(`[restoreJob] Error restoring job #${job.jobNo}:`, error);
            await this._showAlertMessage(`Failed to restore job #${job.jobNo}`);
            return { gpsCourier: undefined };
        }
    }

    private async _validateJobForRestore(job: IJob): Promise<{ isValid: boolean; courier?: ActiveCourierViewModel }> {
        const courierId = job?.courierData?.courierId;
        if (courierId === undefined) {
            await this._handleError("Job has no assigned courier to restore from");
            return { isValid: false };
        }

        const courier = await this._findCourierById(courierId);

        if (courier == undefined) {
            await this._handleError(`Could not find courier with ID ${courierId}`);
            return { isValid: false };
        }

        return { isValid: true, courier };
    }

    private async _processJobRestore(job: IJob, courier: ActiveCourierViewModel) {
        console.log(`[_processJobRestore] Starting restore process for job #${job.jobNo} with ID ${job.id}`);

        try {
            console.log(`[_processJobRestore] Adding restore event for job ID ${job.id}`);
            await this.DispatchData.addRestoreEvent(job.id);

            if (job.displaySplitJobDetail) {
                console.log(`[_processJobRestore] Job #${job.jobNo} is a split job, restoring all split jobs`);
                await this.DispatchData.restoreSplitJobs([job.id]);
            } else {
                console.log(`[_processJobRestore] Job #${job.jobNo} is a standard job, restoring`);
                await this.DispatchData.restoreJobs([job.id]);
            }

            console.log(`[_processJobRestore] Successfully completed restore process for job #${job.jobNo}, courier ID: ${courier.id}`);
            return courier;
        } catch (error) {
            console.error(`[_processJobRestore] Error during restore process for job #${job.jobNo}:`, error);
            throw error;
        }
    }

    private _logJobInfo(job: IJob) {
        console.log("Restoring job:", {
            jobNo: job?.jobNo,
            jobId: job?.id,
            courierId: job?.courierData?.courierId
        });
    }

    private async _handleError(message: string): Promise<never> {
        console.warn(message);
        await this._showAlertMessage(message);
        throw new Error(message);
    }

    private async _findCourierById(courierId: number | undefined): Promise<ActiveCourierViewModel | undefined> {
        if (courierId == undefined) {
            return undefined;
        }

        return await this.DispatchData.getCourierById(courierId);
    }

    private async _showAlertMessage(textContent: string) {
        const alert = this.$mdDialog.alert()
            .parent(document.body)
            .clickOutsideToClose(true)
            .title("Unable to Despatch")
            .textContent(textContent)
            .ariaLabel("unable to despatch")
            .ok("OK");

        await this.$mdDialog.show(alert);
    }
}

export default DispatchExecutorService;
