class DispatchJobService {
    static $inject = ["$mdDialog", "$document", "uCSData", "DispatchData"];

    constructor($mdDialog, $document, uCSData, DispatchData) {
        this.$mdDialog = $mdDialog;
        this.$document = $document;
        this.uCSData = uCSData;
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

        return this.dispatchJob(courierNumber, job);
    }

    /**
     * @param {number} courierNumber
     * @param job
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
                return await this._dispatchJobsContinue(courierNumber, foundCourier, true, job);
            } catch (error) {
                // user clicked 'No'
            }
        }
        return await this._dispatchJobsContinue(courierNumber, foundCourier, false, job);
    };

    /**
     * @param {number} courierNumber
     * @param {boolean} foundCourier
     * @param {boolean} offline
     * @param job
     */
    async _dispatchJobsContinue(courierNumber, foundCourier, offline, job) {
        const callData = {
            "call": "dispatchJobs",
            "courier": courierNumber,
            "jobs": []
        };

        const jobNumber = job.jobNo;
        if (job.courierData.courierID !== null) {
            this.$mdDialog.show(
                this.$mdDialog.alert()
                    .parent(angular.element(this.$document.body))
                    .clickOutsideToClose(true)
                    .title('Message')
                    .textContent('Restore ' + jobNumber + ' prior to despatching to another courier')
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
                    .textContent("DG job " + jobNumber + " can not be despatched to courier " + courierNumber + " - doesn't have DGLicense.")
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

        callData.jobs.push(job.id);

        const response = await this.uCSData.allocateJobs(foundCourier.courierID, ContactID, callData.jobs);
        angular.element("input.pod-DispatchField:visible").val("");

        return response;
    }
}

angular.module('uDispatch').service('dispatchJobService', DispatchJobService);
