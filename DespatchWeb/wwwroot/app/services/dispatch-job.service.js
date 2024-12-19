/**
 * @fileoverview Service for managing job dispatching operations.
 * @module DispatchJobService
 */
class DispatchJobService {
    constructor($mdDialog, $document, DispatchData, moment) {
        console.log('Initializing DispatchJobService');

        this.$mdDialog = $mdDialog;
        this.$document = $document;
        this.dispatchData = DispatchData;
        this.moment = moment;

        /** @type {Array} List of active couriers */
        this.pickCouriers = [];
        /** @type {Array} List of all couriers */
        this.pickAllCouriers = [];

        // Bind all methods to the instance
        this.fetchCouriersData = this.fetchCouriersData.bind(this);
        this.getJobListWithCourierData = this.getJobListWithCourierData.bind(this);
        this.getCurrentJobsForCourier = this.getCurrentJobsForCourier.bind(this);
        this.dispatchJobByJobId = this.dispatchJobByJobId.bind(this);
        this.dispatchJobs = this.dispatchJobs.bind(this);
        this.dispatchJob = this.dispatchJob.bind(this);
        this.dispatchJobsFromPotentialCouriers = this.dispatchJobsFromPotentialCouriers.bind(this);
        this.findCourier = this.findCourier.bind(this);
        this.showOfflineCourierDialog = this.showOfflineCourierDialog.bind(this);
        this.dispatchJobsContinue = this.dispatchJobsContinue.bind(this);
        this.requiresFollowupEvent = this.requiresFollowupEvent.bind(this);
        this.validateJob = this.validateJob.bind(this);
        this.processValidJobs = this.processValidJobs.bind(this);
        this.restoreJob = this.restoreJob.bind(this);
        this._showAlertMessage = this._showAlertMessage.bind(this);
    }

    /**
     * Fetch couriers data from the server.
     * @returns {Promise<void>} A promise that resolves when the data is fetched.
     */
    async fetchCouriersData() {
        console.log('Fetching couriers data...');
        try {
            const [activeCouriers, allCouriers] = await Promise.all([
                this.dispatchData.getActiveCouriers(),
                this.dispatchData.getAllCouriers()
            ]);

            this.pickCouriers = activeCouriers;
            this.pickAllCouriers = allCouriers;

            console.log('Couriers data fetched:', {
                activeCouriers: this.pickCouriers.length,
                allCouriers: this.pickAllCouriers.length
            });
        } catch (error) {
            console.error('Error fetching couriers data:', error);
            throw error;
        }
    }

    /**
     * Get job list with courier data
     * @param {Object} queryParams - Query parameters for filtering jobs
     * @param {Array} selectedClients - List of selected client IDs
     * @param {boolean} isInternal - Whether this is an internal request
     * @param {Array} selectedAreas - List of selected areas
     * @returns {Promise<{jobs: Array, undispatchedJobs: Array}>}
     */
    async getJobListWithCourierData(queryParams, selectedClients, isInternal, selectedAreas) {
        console.log('Getting job list with courier data:', {
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
            const unDispatchedJobs = result.items.filter(job =>
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
            console.error('Error in getJobListWithCourierData:', error);
            throw error;
        }
    }

    /**
     * Get current jobs for a courier with full courier details
     * @param {number} courierId - The courier ID
     * @param {boolean} isDone - Whether to get completed jobs
     * @returns {Promise<{jobs: Array, courier: Object}>}
     */
    async getCurrentJobsForCourier(courierId, isDone = false) {
        console.log('Getting current jobs for courier:', courierId);

        try {
            await this.fetchCouriersData();

            // Find courier in both active and all couriers
            const foundCourier = this.pickCouriers.find(c => c?.courierId === courierId) ||
                this.pickAllCouriers.find(c => c?.courierId === courierId);

            console.log('Found courier:', foundCourier);

            if (!foundCourier) {
                console.warn(`No courier found for ID: ${courierId}`);
                return {jobs: [], courier: null};
            }

            // Get jobs data
            const jobs = await this.dispatchData.getJobsCurrent(courierId, isDone);
            console.log(`Retrieved ${jobs.length} jobs for courier`);

            // If no jobs but have courier, get position
            let courierPosition = null;
            if (jobs.length === 0 && foundCourier.id) {
                try {
                    courierPosition = await this.dispatchData.getCourierPosition(foundCourier.id);
                    console.log('Retrieved courier position:', courierPosition);
                } catch (error) {
                    console.warn('Error getting courier position:', error);
                }
            }

            return {
                jobs,
                courier: foundCourier,
                position: courierPosition
            };
        } catch (error) {
            console.error('Error in getCurrentJobsForCourier:', error);
            throw error;
        }
    }

    /**
     * Dispatch a job by its ID to a specific courier.
     * @param {number} courierId - The ID of the courier.
     * @param {number} jobId - The ID of the job to dispatch.
     */
    async dispatchJobByJobId(courierId, jobId) {
        console.log('Dispatching job by ID:', {courierId, jobId});
        try {
            await this.fetchCouriersData();
            const job = await this.dispatchData.getJobDetail(jobId);
            console.log('Job details fetched:', job);

            const foundCourier = this.pickAllCouriers.find(c => c?.courierId === courierId);
            console.log('Found courier:', foundCourier);

            if (!foundCourier) {
                console.warn(`Could not find courier with ID ${courierId}`);
                await this._showAlertMessage(`Could not find courier with ID ${courierId}`);
                return;
            }

            await this.dispatchJob(foundCourier.id, job);
        } catch (error) {
            console.error('Error in dispatchJobByJobId:', error);
            throw error;
        }
    }

    /**
     * Dispatch multiple jobs to a specific courierId.
     * @param {number} courierId - The ID of the courier.
     * @param {Job[]} jobs - An array of job objects to dispatch.
     * @returns {Promise} A promise that resolves when the job is dispatched.
     */
    async dispatchJobsBycourierId(courierId, jobs) {
        console.log('Dispatching multiple jobs by courier ID:', {courierId, jobCount: jobs.length});
        try {
            await this.fetchCouriersData();
            const foundCourier = this.pickAllCouriers.find(c => c.courierId === courierId);
            console.log('Found courier:', foundCourier);

            if (foundCourier) {
                await this.dispatchJobsContinue(foundCourier, jobs);
            } else {
                console.warn(`Could not find courier with ID ${courierId}`);
            }
        } catch (error) {
            console.error('Error in dispatchJobsBycourierId:', error);
            throw error;
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
        } catch (error) {
            await this._showAlertMessage("Failed to dispatch jobs: " + error.message);
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
        // First validate all jobs
        const validationResults = await Promise.all(
            jobs.map(job => this.validateJob(job, courier))
        );

        // Filter out invalid jobs and collect error messages
        const validJobs = [];
        const errorMessages = [];

        jobs.forEach((job, index) => {
            if (validationResults[index].isValid) {
                validJobs.push(job);
            } else {
                errorMessages.push(validationResults[index].message);
            }
        });

        // If there are any error messages, show them
        if (errorMessages.length > 0) {
            await this._showAlertMessage(errorMessages.join('\n'));
            // If all jobs are invalid, return early
            if (validJobs.length === 0) {
                return;
            }
        }

        // Process valid jobs
        await this.processValidJobs(courier, validJobs);
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
     * @returns {Promise<{isValid: boolean, message: string}>} Validation result and error message if invalid
     */
    async validateJob(job, courier) {
        console.log('Validating job:', {
            jobNo: job?.jobNo,
            courierId: courier?.id,
            hasDG: job?.dgClass > 0
        });

        if (job.courierData !== null) {
            const message = `Restore ${job.jobNo} prior to dispatching to another courier`;
            console.warn('Job validation failed:', message);
            return {isValid: false, message};
        }

        if (job.dgClass !== null && job.dgClass > 0) {
            if (!courier.dangerousGoods) {
                const message = `DG job ${job.jobNo} can not be dispatched to courier ${courier.id} - doesn't have DGLicense.`;
                console.warn('Job validation failed:', message);
                return {isValid: false, message};
            }

            if (job.DGLicenseExpiry === null || this.moment(courier.dgLicenseExpiry) < this.moment().add(1, 'days')) {
                const message = `Courier ${courier.id} doesn't have a DGLicense or license has expired.`;
                console.warn('Job validation failed:', message);
                return {isValid: false, message};
            }
        }

        console.log('Job validation passed:', job.jobNo);
        return {isValid: true, message: ''};
    }

    /**
     * Process a batch of valid jobs for dispatch
     * @private
     * @param {Object} courier - The courier object
     * @param {Job[]} jobs - Array of validated jobs
     * @returns {Promise<void>}
     */
    async processValidJobs(courier, jobs) {
        console.log('Processing valid jobs:', {
            courierId: courier?.id,
            jobCount: jobs?.length
        });

        try {
            const jobsRequiringFollowup = jobs.filter(job => this.requiresFollowupEvent(job));
            console.log('Jobs requiring followup:', jobsRequiringFollowup.length);

            if (jobsRequiringFollowup.length > 0) {
                console.log('Processing followup events');
                await Promise.all(jobsRequiringFollowup.map(job =>
                    this.dispatchData.addFollowupEvent(
                        job.jobNo, job.clientId, job.contactName, ContactID,
                        courier.courierId, job.id, job.jobType, FirstName
                    )
                ));
            }

            const jobIds = jobs.map(job => job.id);
            console.log('Allocating jobs:', jobIds.length);

            await this.dispatchData.allocateJobs(courier.courierId, ContactID, jobIds);
            console.log('Jobs processed successfully');

        } catch (error) {
            console.error('Error processing valid jobs:', error);
            await this._showAlertMessage(`Failed to dispatch jobs: ${error.message}`);
            throw error;
        }
    }

    /**
     * Restore a single job from a courier
     * @param {Job} job - The job to restore
     * @returns {Promise<{gpsCourier: number}>} The courier GPS ID for UI updates
     * @throws {Error} If restoration fails
     */
    async restoreJob(job) {
        console.log('Restoring job:', {
            jobNo: job?.jobNo,
            jobId: job?.id,
            courierId: job?.courierData?.courierId
        });

        if (!job?.courierData?.courierId) {
            const message = 'Job has no assigned courier to restore from';
            console.warn(message);
            await this._showAlertMessage(message);
            throw new Error(message);
        }

        try {
            // Add restore event
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

            // Fetch the couriers
            await this.fetchCouriersData();

            // Find the courier
            const foundCourier = this.pickCouriers.find(c => c.courierId === job.courierData.courierId) ||
                this.pickAllCouriers.find(c => c.courierId === job.courierData.courierId);

            if (!foundCourier) {
                const message = `Could not find courier with ID ${job.courierData.courierId}`;
                console.error(message);
                await this._showAlertMessage(message);
                throw new Error(message);
            }

            // Restore the job based on whether it's a split job or not
            if (job.displaySplitJobDetail) {
                await this.dispatchData.restoreSplitJobs(
                    foundCourier.courierId,
                    ContactID,
                    [job.id]
                );
            } else {
                await this.dispatchData.restoreJobs(
                    foundCourier.courierId,
                    ContactID,
                    [job.id]
                );
            }

            console.log('Job restored successfully');
            return {gpsCourier: foundCourier.id};

        } catch (error) {
            console.error('Error restoring job:', error);
            await this._showAlertMessage(`Failed to restore job: ${error.message}`);
        }
    }

    /*
     * Show an alert message dialog.
     * @private
     * @param {string} textContent - The message to display in the alert.
     * @returns {Promise} A promise that resolves when the dialog is closed
     */
    async _showAlertMessage(textContent) {
        const alert = this.$mdDialog.alert()
            .parent(this.$document.body)
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
