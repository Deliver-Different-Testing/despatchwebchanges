class DispatchJobService {
    static $inject = ["$mdDialog", "$document", "DispatchData", "moment"];

    constructor($mdDialog, $document, DispatchData, moment) {
        this._$mdDialog = $mdDialog;
        this._$document = $document;
        this._dispatchData = DispatchData;
        this._moment = moment;
        this._pickCouriers = [];
        this._pickAllCouriers = [];

        this._fetchCouriersData();
    }

    _fetchCouriersData() {
        this._fetchActiveCouriersData();
        this._fetchAllCouriersData();
    }

    _fetchActiveCouriersData() {
        this._dispatchData.getActiveCouriers().then(data => this._pickCouriers = data);
    }

    _fetchAllCouriersData() {
        this._dispatchData.getAllCouriers().then(data => this._pickAllCouriers = data);
    }

    /**
     * @param {number} courierNumber
     * @param {number} jobId
     */
    async dispatchJobByJobId(courierNumber, jobId) {
        const job = this._dispatchData.getJobDetail(jobId);
        const selectedCourier = this._pickAllCouriers.find(c => c.courierID === courierNumber);

        await this.dispatchJob(selectedCourier.id, job);
    }

    /**
     * @param {number} courierNumber
     * @param {Job[]} jobs
     */
    async dispatchJobs(courierNumber, jobs) {
        let foundCourier = await this._findCourier(courierNumber);
        await this._dispatchJobsContinue(courierNumber, foundCourier, jobs);
    }

    /**
     * @param {number} courierNumber
     * @param {Job} job
     */
    async dispatchJob(courierNumber, job) {
        let foundCourier = await this._findCourier(courierNumber);
        let jobsArray = [job]; // Wrap the job into an array
        await this._dispatchJobsContinue(courierNumber, foundCourier, jobsArray);
    }

    /**
     * @param {number} courierNumber
     */
    async _findCourier(courierNumber) {
        // Refresh list
        this._fetchActiveCouriersData();

        let foundCourier = this._pickCouriers.find(c => c.id === courierNumber);
        if (foundCourier === undefined) {
            const confirm = this._generateOfflineCourierDialog();

            try {
                await this._$mdDialog.show(confirm);
                foundCourier = this._pickAllCouriers.find(c => c.id === courierNumber);
            } catch (error) {
                console.log("User chose not to dispatch job as courier is offline");
            }
        }
        return foundCourier;
    }

    _generateOfflineCourierDialog() {
        return this._$mdDialog.confirm()
            .title('Courier Offline')
            .textContent('Dispatch anyway?')
            .ok('Yes')
            .cancel('No');
    }

    /**
     * @param {number} courierNumber
     * @param {*} foundCourier
     * @param {Job[]} job
     */
    async _dispatchJobsContinue(courierNumber, foundCourier, job) {
        let jobs = [];

        const jobNumber = job.jobNo;

        if (job.courierData && job.courierData.courierID !== null) {
            this._showAlertMessage('Restore ' + jobNumber + ' prior to dispatching to another courier');
            return;
        }
        if (job.dgClass !== null && job.dgClass > 0 && !foundCourier.dangerousGoods) {
            this._showAlertMessage("DG job " + jobNumber + " can not be dispatched to courier " + courierNumber + " - doesn't have DGLicense.");
            return;
        }
        if (job.dgClass !== null && job.dgClass > 0 && (job.DGLicenseExpiry === null || this._moment(foundCourier.dgLicenseExpiry) < this._moment().add(1, 'days'))) {
            this._showAlertMessage("Courier " + courierNumber + " doesn't have a DGLicense or license has expired.");
            return;
        }

        jobs.push(job.id);
        await this._dispatchData.allocateJobs(foundCourier.courierID, ContactID, jobs);
    }


    /**
     * @param {string} textContent
     */
    _showAlertMessage(textContent) {
        const alert = this._$mdDialog.alert()
            .parent(angular.element(this._$document.body))
            .clickOutsideToClose(true)
            .title('Message')
            .textContent(textContent)
            .ariaLabel('Alert')
            .ok('OK');

        this._$mdDialog.show(alert);
    }
}

angular.module('uDispatch').service('dispatchJobService', DispatchJobService);
