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

        this.fetchCouriersData();
    }

    /**
     * Fetch couriers data from the server.
     * @returns {Promise} A promise that resolves when the data is fetched.
     */
    fetchCouriersData() {
        Promise.all([
            this.dispatchData.getActiveCouriers(),
            this.dispatchData.getAllCouriers()
        ]).then(([activeCouriers, allCouriers]) => {
            this.pickCouriers = activeCouriers;
            this.pickAllCouriers = allCouriers;
        });
    }

    /**
     * Dispatch a job by its ID to a specific courier.
     * @param {number} courierId - The ID of the courier.
     * @param {number} jobId - The ID of the job to dispatch.
     * @returns {Promise} A promise that resolves when the job is dispatched.
     */
    async dispatchJobByJobId(courierId, jobId) {
        const job = await this.dispatchData.getJobDetail(jobId);
        const selectedCourier = this.pickAllCouriers.find(c => c.courierID === courierId);
        await this.dispatchJob(selectedCourier.id, job);
    }

    /**
     * Dispatch multiple jobs to a specific courier.
     * @param {number} courierNumber - The ID of the courier.
     * @param {Job[]} jobs - An array of job objects to dispatch.
     * @returns {Promise} A promise that resolves when all jobs are dispatched.
     */
    async dispatchJobs(courierNumber, jobs) {
        const foundCourier = await this.findCourier(courierNumber);
        if (foundCourier) {
            await this.dispatchJobsContinue(courierNumber, foundCourier, jobs);
        }
    }

    /**
     * Dispatch a single job to a specific courier.
     * @param {number} courierNumber - The ID of the courier.
     * @param {Job} job - The job object to dispatch.
     * @returns {Promise} A promise that resolves when the job is dispatched.
     */
    async dispatchJob(courierNumber, job) {
        const foundCourier = await this.findCourier(courierNumber);
        if (foundCourier) {
            await this.dispatchJobsContinue(courierNumber, foundCourier, [job]);
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
     * @param {number} courierNumber - The ID of the courier.
     * @param {Object} foundCourier - The found courier object.
     * @param {Array<Object>} jobs - An array of job objects to dispatch.
     * @returns {Promise} A promise that resolves when all jobs are processed.
     */
    async dispatchJobsContinue(courierNumber, foundCourier, jobs) {
        const jobIds = [];

        for (const job of jobs) {
            if (!this.validateJob(job, foundCourier)) continue;

            if (job.dgClass !== null && job.dgClass > 0) {
                await this.dispatchData.addFollowupEvent(
                    job.jobNo, job.clientId, job.contactName,
                    ContactID, foundCourier.courierID, job.id,
                    job.jobType, FirstName
                );
            }

            jobIds.push(job.id);
        }

        if (jobIds.length > 0) {
            await this.dispatchData.allocateJobs(foundCourier.courierID, jobs[0].ContactID, jobIds);
        }
    }

    /**
     * Validate a job before dispatching.
     * @param {Job} job - The job object to validate.
     * @param {Object} courier - The courier object to validate against.
     * @returns {boolean} True if the job is valid for dispatching, false otherwise.
     */
    validateJob(job, courier) {
        if (job.courierData && job.courierData.courierID !== null) {
            this.showAlertMessage(`Restore ${job.jobNo} prior to dispatching to another courier`);
            return false;
        }

        if (job.dgClass !== null && job.dgClass > 0) {
            if (!courier.dangerousGoods) {
                this.showAlertMessage(`DG job ${job.jobNo} can not be dispatched to courier ${courier.id} - doesn't have DGLicense.`);
                return false;
            }

            if (job.DGLicenseExpiry === null || this.moment(courier.dgLicenseExpiry) < this.moment().add(1, 'days')) {
                this.showAlertMessage(`Courier ${courier.id} doesn't have a DGLicense or license has expired.`);
                return false;
            }
        }

        return true;
    }

    /**
     * Show an alert message dialog.
     * @param {string} textContent - The message to display in the alert.
     */
    showAlertMessage(textContent) {
        const alert = this.$mdDialog.alert()
            .parent(angular.element(this.$document.body))
            .clickOutsideToClose(true)
            .title('Unable to Despatch')
            .textContent(textContent)
            .ariaLabel('unable to despatch')
            .ok('OK');

        this.$mdDialog.show(alert);
    }
}

angular.module('uDispatch').service('dispatchJobService', [
    '$mdDialog',
    '$document',
    'DispatchData',
    'moment',
    ($mdDialog, $document, DispatchData, moment) => new DispatchJobService($mdDialog, $document, DispatchData, moment)
]);
