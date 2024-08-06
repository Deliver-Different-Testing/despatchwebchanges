class DispatchJobService {
    static $inject = ["$mdDialog", "$document", "DispatchData"];

    constructor($mdDialog, $document, DispatchData) {
        this.$mdDialog = $mdDialog;
        this.$document = $document;
        this.DispatchData = DispatchData;
        this.pickCouriers = [];
        this.pickAllCouriers = [];

        this._fetchCouriersData();
    }

    _fetchCouriersData() {
        this.DispatchData.getActiveCouriers().then(data => {
            this.pickCouriers = data;
        });

        this.DispatchData.getAllCouriers().then(data => {
            this.pickAllCouriers = data;
        });
    }

    /**
     * @param {number} courierNumber
     * @param {number} jobId
     */
    async dispatchJobByJobId(courierNumber, jobId) {
        const job = this.DispatchData.getJobDetail(jobId);
        const selectedCourier = this.pickAllCouriers.find(c => c.courierID === courierNumber);

        return await this.dispatchJob(selectedCourier.id, job);
    }

    /**
     * @param {number} courierNumber
     * @param {Job} job
     */
    async dispatchJob(courierNumber, job) {
        let foundCourier = this.pickCouriers.find(c => c.id === courierNumber);

        if (foundCourier === undefined) {
            const confirm = this.$mdDialog.confirm()
                .title('Courier Offline')
                .textContent('Dispatch anyway?')
                .ok('Yes')
                .cancel('No');

            try {
                await this.$mdDialog.show(confirm);
                foundCourier = this.pickAllCouriers.find(c => c.id === courierNumber);
                return await this._dispatchJobsContinue(courierNumber, foundCourier, job);
            } catch (error) {
                // user clicked 'No'
            }
        }
        return await this._dispatchJobsContinue(courierNumber, foundCourier, job);
    }

    /**
     * @param {number} courierNumber
     * @param {*} foundCourier
     * @param {Job} job
     */
    async _dispatchJobsContinue(courierNumber, foundCourier, job) {
        let jobs = [];

        const jobNumber = job.jobNo;
        if (job.courierData && job.courierData.courierID !== null) {
            this.$mdDialog.show(
                this.$mdDialog.alert()
                    .parent(angular.element(this.$document.body))
                    .clickOutsideToClose(true)
                    .title('Message')
                    .textContent('Restore ' + jobNumber + ' prior to dispatching to another courier')
                    .ariaLabel('Alert')
                    .ok('OK')
            );

            return;
        }

        if (job.dgClass !== null && job.dgClass > 0 && !foundCourier.dangerousGoods) {
            this.$mdDialog.show(
                this.$mdDialog.alert()
                    .parent(angular.element(this.$document.body))
                    .clickOutsideToClose(true)
                    .title('Message')
                    .textContent("DG job " + jobNumber + " can not be dispatched to courier " + courierNumber + " - doesn't have DGLicense.")
                    .ariaLabel('Alert')
                    .ok('OK')
            );

            return;
        }

        if (job.dgClass !== null && job.dgClass > 0 && (job.DGLicenseExpiry === null ||
            moment(foundCourier.dgLicenseExpiry) < moment().add(1, 'days'))) {
            this.$mdDialog.show(
                this.$mdDialog.alert()
                    .parent(angular.element(this.$document.body))
                    .clickOutsideToClose(true)
                    .title('Message')
                    .textContent("Courier " + courierNumber + " doesn't have a DGLicense or license has expired.")
                    .ariaLabel('Alert')
                    .ok('OK')
            );

            return;
        }

        jobs.push(job.id);
        return await this.DispatchData.allocateJobs(foundCourier.courierID, ContactID, jobs);
    }
}

angular.module('uDispatch').service('dispatchJobService', DispatchJobService);
