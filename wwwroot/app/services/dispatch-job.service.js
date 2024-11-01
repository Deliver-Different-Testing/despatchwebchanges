/**
 * @fileoverview Service for managing job dispatching operations.
 * @module DispatchJobService
 */

/**
 * A service for dispatching jobs
 * @class
 */
class DispatchJobService {
    /**
     * Create a DispatchJobService.
     * @param {Object} $mdDialog - Angular Material's dialog service.
     * @param {Object} $document - Angular's wrapper for the browser's window.document object.
     * @param {Object} DispatchData - Service for fetching dispatch-related data.
     * @param {Object} moment - Moment.js library for date manipulation.
     */
    constructor($mdDialog, $document, DispatchData, moment) {
        this.$mdDialog = $mdDialog;
        this.$document = $document;
        this.dispatchData = DispatchData;
        this.moment = moment;

        /** @type {Array} List of active couriers */
        this.pickCouriers = [];
        /** @type {Array} List of all couriers */
        this.pickAllCouriers = [];
    }

    /**
     * Fetch couriers data from the server.
     * @returns {Promise<void>} A promise that resolves when the data is fetched.
     */
    async fetchCouriersData() {
        const [activeCouriers, allCouriers] = await Promise.all([
            this.dispatchData.getActiveCouriers(),
            this.dispatchData.getAllCouriers()
        ]);

        this.pickCouriers = activeCouriers;
        this.pickAllCouriers = allCouriers;
    }

    /**
     * Dispatch a job by its ID to a specific courier.
     * @param {number} courierId - The ID of the courier.
     * @param {number} jobId - The ID of the job to dispatch.
     */
    async dispatchJobByJobId(courierId, jobId) {
        await this.fetchCouriersData();

        const job = await this.dispatchData.getJobDetail(jobId);
        const foundCourier = this.pickAllCouriers.find(c => c?.courierID === courierId);

        if (!foundCourier) {
            await this.showAlertMessage(`Could not find courier with ID ${courierId}`);
            return;
        }

        await this.dispatchJob(foundCourier.id, job);
    }

    /**
     * Dispatch multiple jobs to a specific courierId.
     * @param {number} courierId - The ID of the courier.
     * @param {Job[]} jobs - An array of job objects to dispatch.
     * @returns {Promise} A promise that resolves when the job is dispatched.
     */
    async dispatchJobsByCourierId(courierId, jobs) {
        await this.fetchCouriersData();
        const foundCourier = this.pickAllCouriers.find(c => c.courierID === courierId);

        if (foundCourier) {
            await this.dispatchJobsContinue(foundCourier, jobs);
        }
    }

    /**
     * Dispatch multiple jobs to a specific courier.
     * @param {number} courierNumber - The ID of the courier.
     * @param {Job[]} jobs - An array of job objects to dispatch.
     * @returns {Promise} A promise that resolves when all jobs are dispatched.
     */
    async dispatchJobs(courierNumber, jobs) {
        await this.fetchCouriersData();
        const foundCourier = await this.findCourier(courierNumber);

        if (foundCourier) {
            await this.dispatchJobsContinue(foundCourier, jobs);
        }
    }

    /**
     * Dispatch a single job to a specific courier.
     * @param {number} courierNumber - The ID of the courier.
     * @param {Job} job - The job object to dispatch.
     * @returns {Promise} A promise that resolves when the job is dispatched.
     */
    async dispatchJob(courierNumber, job) {
        await this.fetchCouriersData();
        const foundCourier = await this.findCourier(courierNumber);

        if (foundCourier) {
            await this.dispatchJobsContinue(foundCourier, [job]);
        }
    }

    /**
     * Dispatch jobs from a list of potential couriers
     */
    async dispatchJobsFromPotentialCouriers(courierId, jobList, contactId, firstName) {
        await this.fetchCouriersData();

        // Find courier in active couriers list
        const foundCourier = this.pickCouriers.find(c => c?.id === courierId);
        if (!foundCourier || !foundCourier.courierID) {
            await this.showAlertMessage(`Could not find active courier with ID ${courierId}`);
            return;
        }

        // Filter and validate jobs
        const validJobs = [];
        const activeJobs = jobList.filter(job => job && job.isActive);  // Add null check for job

        for (const job of activeJobs) {
            // Validate each job
            if (!job || !this.validateJob(job, foundCourier)) {
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
                    foundCourier.courierID,
                    job.id,
                    job.jobType,
                    firstName
                );
            }
        }

        if (validJobs.length === 0) {
            await this.showAlertMessage("No valid jobs to dispatch");
            return;
        }

        // Allocate jobs and update data
        try {
            await this.dispatchData.allocateJobs(
                foundCourier.courierID,
                contactId,
                validJobs
            );

            // Return the courier info for any UI updates needed
            return {
                gpsCourier: foundCourier.id
            };
        } catch (error) {
            await this.showAlertMessage("Failed to dispatch jobs: " + error.message);
            throw error;
        }
    }


    /**
     * Find a courier by their ID.
     * @param {number} courierNumber - The ID of the courier to find.
     * @returns {Promise<Object|null>} A promise that resolves with the found courier object or null.
     */
    async findCourier(courierNumber) {
        await this.fetchCouriersData();

        let foundCourier = this.pickCouriers.find(c => c.id === courierNumber);
        if (!foundCourier) {
            const confirmed = await this.showOfflineCourierDialog();
            if (confirmed) {
                foundCourier = this.pickAllCouriers.find(c => c.id === courierNumber);
            }
        }
        return foundCourier;
    }

    /**
     * Show a dialog to confirm dispatching to an offline courier.
     * @returns {Promise<boolean>} A promise that resolves with the user's decision.
     */
    showOfflineCourierDialog() {
        return this.$mdDialog.show(
            this.$mdDialog.confirm()
                .title('Courier Offline')
                .textContent('Dispatch anyway?')
                .ok('Yes')
                .cancel('No')
        );
    }

    /**
     * Continue the process of dispatching jobs after finding the courier.
     * @param {Object} courier - The found courier object
     * @param {Array<Object>} jobs - An array of job objects to dispatch
     * @returns {Promise<void>} A promise that resolves when all jobs are processed
     */
    async dispatchJobsContinue(courier, jobs) {
        const validJobs = jobs.filter(job => this.validateJob(job, courier));

        if (validJobs.length === 0) {
            return;
        }

        await this.processValidJobs(courier, validJobs);
    }

    /**
     * Process a batch of valid jobs for dispatch
     * @private
     * @param {Object} courier - The courier object
     * @param {Job[]} jobs - Array of validated jobs
     * @returns {Promise<void>}
     */
    async processValidJobs(courier, jobs) {
        const jobsRequiringFollowup = jobs.filter(job => this.requiresFollowupEvent(job));

        // Process followup events first
        await Promise.all(jobsRequiringFollowup.map(job =>
            this.dispatchData.addFollowupEvent(
                job.jobNo,
                job.clientId,
                job.contactName,
                ContactID,
                courier.courierID,
                job.id,
                job.jobType,
                FirstName
            )
        ));

        // Allocate all valid jobs
        const jobIds = jobs.map(job => job.id);
        await this.dispatchData.allocateJobs(
            courier.courierID,
            ContactID,
            jobIds
        );
    }

    /**
     * Check if a job requires a followup event
     * @private
     * @param {Object} job - The job to check
     * @returns {boolean}
     */
    requiresFollowupEvent(job) {
        return job.dgClass !== null && job.dgClass > 0;
    }

    /**
     * Validate a job before dispatching.
     * @param {Job} job - The job object to validate.
     * @param {Object} courier - The courier object to validate against.
     * @returns {boolean} True if the job is valid for dispatching, false otherwise.
     */
    async validateJob(job, courier) {
        if (job.courierData && job.courierData.courierID !== null) {
            await this.showAlertMessage(`Restore ${job.jobNo} prior to dispatching to another courier`);
            return false;
        }

        if (job.dgClass !== null && job.dgClass > 0) {
            if (!courier.dangerousGoods) {
                await this.showAlertMessage(`DG job ${job.jobNo} can not be dispatched to courier ${courier.id} - doesn't have DGLicense.`);
                return false;
            }

            if (job.DGLicenseExpiry === null || this.moment(courier.dgLicenseExpiry) < this.moment().add(1, 'days')) {
                await this.showAlertMessage(`Courier ${courier.id} doesn't have a DGLicense or license has expired.`);
                return false;
            }
        }

        return true;
    }

    /**
     * Show an alert message dialog.
     * @param {string} textContent - The message to display in the alert.
     * @returns {Promise} A promise that resolves when the dialog is closed
     */
    async showAlertMessage(textContent) {
        const alert = this.$mdDialog.alert()
            .parent(angular.element(this.$document.body))
            .clickOutsideToClose(true)
            .title('Unable to Despatch')
            .textContent(textContent)
            .ariaLabel('unable to despatch')
            .ok('OK');

        return await this.$mdDialog.show(alert);
    }
}

angular.module('uDispatch').service('dispatchJobService', [
    '$mdDialog',
    '$document',
    'DispatchData',
    'moment',
    ($mdDialog, $document, DispatchData, moment) => new DispatchJobService($mdDialog, $document, DispatchData, moment)
]);
