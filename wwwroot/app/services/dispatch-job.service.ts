import app from "../app";
import angular from "angular";
import {Job} from "../interfaces/job.interface";
import {ActiveCourier} from "../interfaces/courier.interface";

class DispatchJobService {
    static $inject = ["$mdDialog", "DispatchData", "moment"];

    private pickCouriers: ActiveCourier[];
    private pickAllCouriers: ActiveCourier[];

    constructor(private $mdDialog: angular.material.IDialogService,
                private dispatchData: any,
                private moment: any) {
        console.log("Initializing DispatchJobService");


        this.pickCouriers = [];
        this.pickAllCouriers = [];

        // Bind all methods to the instance
        this.fetchCouriersData = this.fetchCouriersData.bind(this);
        this.getJobListWithCourierData = this.getJobListWithCourierData.bind(this);
        this.getCurrentJobsForCourier = this.getCurrentJobsForCourier.bind(this);
        this.dispatchJobByJobId = this.dispatchJobByJobId.bind(this);
        this.dispatchJobs = this.dispatchJobs.bind(this);
        this.dispatchJob = this.dispatchJob.bind(this);
        this.dispatchJobsFromPotentialCouriers = this.dispatchJobsFromPotentialCouriers.bind(this);
        this.findCourierByNumber = this.findCourierByNumber.bind(this);
        this.showOfflineCourierDialog = this.showOfflineCourierDialog.bind(this);
        this.dispatchJobsContinue = this.dispatchJobsContinue.bind(this);
        this.requiresFollowupEvent = this.requiresFollowupEvent.bind(this);
        this.validateJob = this.validateJob.bind(this);
        this.processValidJobs = this.processValidJobs.bind(this);
        this.restoreJob = this.restoreJob.bind(this);
        this._showAlertMessage = this._showAlertMessage.bind(this);
    }

    public async fetchCouriersData(): Promise<void> {
        console.log("Fetching couriers data...");
        try {
            const [activeCouriers, allCouriers] = await Promise.all([
                this.dispatchData.getActiveCouriers(),
                this.dispatchData.getAllCouriers()
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

    public async getJobListWithCourierData(
        queryParams: object,
        selectedClients: Array<any>,
        isInternal: boolean,
        selectedAreas: Array<any>
    ): Promise<{
        items: Array<any>;
        total: number;
        page: number;
        limit: number;
        undispatchedJobs: Array<any>;
        activeCouriers: Array<any>;
        allCouriers: Array<any>;
    }> {
        console.log("Getting job list with courier data:", {
            queryParams,
            clientCount: selectedClients?.length,
            isInternal,
            selectedAreas
        });

        try {
            await this.fetchCouriersData();

            const result = await this.dispatchData.getJobsWithFilters(
                queryParams,
                selectedClients,
                isInternal,
                selectedAreas
            );

            // Get unDispatched jobs (safely handle null courierData)
            const unDispatchedJobs = result.items.filter((job: any) =>
                !job?.courierData?.courierId
            );

            console.log(`Retrieved ${result.items.length} jobs, ${unDispatchedJobs.length} unDispatched`);

            return {
                items: result.items,
                total: result.total,
                page: result.page,
                limit: result.limit,
                undispatchedJobs: unDispatchedJobs,
                activeCouriers: this.pickCouriers,
                allCouriers: this.pickAllCouriers
            };
        } catch (error) {
            console.error("Error in getJobListWithCourierData:", error);
            throw error;
        }
    }

    public async getCurrentJobsForCourier(courierId: number, isDone: boolean = false): Promise<{
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
            const jobs = await this.dispatchData.getJobsCurrent(courierId, isDone);
            console.log(`Retrieved ${jobs.length} jobs for courier`);

            // If no jobs but have courier, get position
            let courierPosition: object | null = null;
            if (jobs.length === 0 && foundCourier.id) {
                try {
                    courierPosition = await this.dispatchData.getCourierPosition(foundCourier.id);
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

    public async dispatchJobByJobId(courierId: number, jobId: number): Promise<void> {
        console.log("Dispatching job by ID:", {courierId, jobId});
        try {
            await this.fetchCouriersData();
            const job = await this.dispatchData.getJobDetail(jobId);
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

    public async dispatchJobsBycourierId(courierId: number, jobs: Job[]): Promise<any> {
        console.log("Dispatching multiple jobs by courier ID:", {courierId, jobCount: jobs.length});
        try {
            await this.fetchCouriersData();
            const foundCourier = this.pickAllCouriers.find(c => c.courierId === courierId);
            console.log("Found courier:", foundCourier);

            if (foundCourier) {
                await this.dispatchJobsContinue(foundCourier, jobs);
            } else {
                console.warn(`Could not find courier with ID ${courierId}`);
            }
        } catch (error) {
            console.error("Error in dispatchJobsBycourierId:", error);
            throw error;
        }
    }

    public async dispatchJobs(courierNumber: number, jobs: Job[]): Promise<any> {
        await this.fetchCouriersData();
        const foundCourier = await this.findCourierByNumber(courierNumber);

        if (foundCourier != null) {
            await this.dispatchJobsContinue(foundCourier, jobs);
        }
    }

    public async dispatchJob(courierNumber: number, job: Job): Promise<any> {
        await this.fetchCouriersData();
        const foundCourier = await this.findCourierByNumber(courierNumber);

        if (foundCourier) {
            await this.dispatchJobsContinue(foundCourier, [job]);
        }
    }

    public async dispatchJobsFromPotentialCouriers(courierId: number, jobList: Job[], contactId: number, firstName: string) {
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
            // Validate each job
            const isValid = await this.validateJob(job, foundCourier);
            if (!job || !isValid) {
                continue; // Skip invalid jobs instead of returning
            }

            validJobs.push(job.id);

            // Handle dangerous goods followup events
            if (this.requiresFollowupEvent(job)) {
                await this.dispatchData.addFollowupEvent(
                    job.jobNo,
                    job.clientId,
                    job.contactName,
                    contactId,
                    foundCourier.courierId,
                    job.id,
                    job.jobType,
                    firstName
                );
            }
        }

        if (validJobs.length === 0) {
            await this._showAlertMessage("No valid jobs to dispatch");
            return;
        }

        // Allocate jobs and update data
        try {
            await this.dispatchData.allocateJobs(
                foundCourier.courierId,
                contactId,
                validJobs
            );

            // Return the courier info for any UI updates needed
            return {
                gpsCourier: foundCourier.id
            };
        } catch (error: any) {
            await this._showAlertMessage(`Failed to dispatch jobs: ${error.message}`);
            throw error;
        }
    }

    private async findCourierByNumber(courierNumber: number): Promise<ActiveCourier | null> {
        if (!courierNumber || courierNumber <= 0) {
            throw new Error('Invalid courier number');
        }

        await this.fetchCouriersData();

        const findCourierById = (couriers: ActiveCourier[], id: number): ActiveCourier | null =>
            couriers.find(c => c.courierId === id) || null;

        // First try to find among active couriers
        const activeCourier = findCourierById(this.pickCouriers, courierNumber);
        if (activeCourier) {
            return activeCourier;
        }

        // If not found among active couriers, ask for confirmation to search offline couriers
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

    private async dispatchJobsContinue(courier: ActiveCourier, jobs: Job[]): Promise<void> {
        // First validate all jobs
        const validationResults = await Promise.all(
            jobs.map(job => this.validateJob(job, courier))
        );

        // Filter out invalid jobs and collect error messages
        const validJobs: Job[] = [];
        const errorMessages: string[] = [];

        jobs.forEach((job, index) => {
            if (validationResults[index].isValid) {
                validJobs.push(job);
            } else {
                errorMessages.push(validationResults[index].message);
            }
        });

        // If there are any error messages, show them
        if (errorMessages.length > 0) {
            await this._showAlertMessage(errorMessages.join("\n"));
            // If all jobs are invalid, return early
            if (validJobs.length === 0) {
                return;
            }
        }

        // Process valid jobs
        await this.processValidJobs(courier, validJobs);
    }

    private requiresFollowupEvent(job: Job): boolean {
        return job.dgClass !== undefined && job.dgClass > 0;
    }

    private async validateJob(job: Job, courier: ActiveCourier): Promise<{ isValid: boolean; message: string; }> {
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

    private async processValidJobs(courier: ActiveCourier, jobs: Job[]): Promise<void> {
        console.log("Processing valid jobs:", {
            courierId: courier?.courierId,
            jobCount: jobs?.length
        });

        try {
            const jobsRequiringFollowup = jobs.filter(job => this.requiresFollowupEvent(job));
            console.log("Jobs requiring followup:", jobsRequiringFollowup.length);

            if (jobsRequiringFollowup.length > 0) {
                console.log("Processing followup events");
                await Promise.all(jobsRequiringFollowup.map(job =>
                    this.dispatchData.addFollowupEvent(
                        job.jobNo, job.clientId, job.contactName, ContactID,
                        courier.courierId, job.id, job.jobType, FirstName
                    )
                ));
            }

            const jobIds = jobs.map(job => job.id);
            console.log("Allocating jobs:", jobIds.length);

            await this.dispatchData.allocateJobs(courier.courierId, ContactID, jobIds);
            console.log("Jobs processed successfully");

        } catch (error: any) {
            console.error("Error processing valid jobs:", error);
            await this._showAlertMessage(`Failed to dispatch jobs: ${error.message}`);
            throw error;
        }
    }

    public async restoreJob(job: Job): Promise<{ gpsCourier: string; }> {
        this.logJobInfo(job);

        const courierId = job?.courierData?.courierId;
        if (courierId == undefined) {
            await this.handleError("Job has no assigned courier to restore from");
        }

        try {
            await this.addRestoreEventForJob(job);
            const foundCourier = await this.findCourierById(courierId);

            if (foundCourier) {
                await this.restoreJobByCourierAndType(job, foundCourier);

                console.log("Job restored successfully");
                return {gpsCourier: foundCourier.id};
            }

            await this.handleError(`Could not find courier with ID ${courierId}`);
            return {gpsCourier: ""};
        } catch (error) {
            console.error("Error restoring job:", error);
            await this._showAlertMessage(`Failed to restore job}`);
            return {gpsCourier: ""};
        }
    }

    private logJobInfo(job: Job): void {
        console.log("Restoring job:", {
            jobNo: job?.jobNo,
            jobId: job?.id,
            courierId: job?.courierData?.courierId
        });
    }

    private async handleError(message: string): Promise<never> {
        console.warn(message);
        await this._showAlertMessage(message);
        throw new Error(message);
    }

    private async addRestoreEventForJob(job: Job): Promise<void> {
        await this.dispatchData.addRestoreEvent(
            job.jobNo,
            job.clientId,
            job.contactName,
            ContactID,
            job.courierData.courierId,
            job.id,
            job.speedId,
            FirstName
        );
    }

    private async findCourierById(courierId: number | undefined): Promise<ActiveCourier | undefined> {
        await this.fetchCouriersData();
        return this.pickCouriers.find(c => c.courierId === courierId) ||
            this.pickAllCouriers.find(c => c.courierId === courierId);
    }

    private async restoreJobByCourierAndType(job: Job, courier: ActiveCourier): Promise<void> {
        const restoreMethod = job.displaySplitJobDetail
            ? this.dispatchData.restoreSplitJobs
            : this.dispatchData.restoreJobs;

        await restoreMethod(courier.courierId, ContactID, [job.id]);
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

app.service("dispatchJobService", DispatchJobService);
