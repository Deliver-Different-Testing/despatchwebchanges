class DispatchJobService {
    static $inject = ["$scope", "$mdDialog", "$document", "uCSData", "DispatchData"];

    constructor($scope, $mdDialog, $document, uCSData, DispatchData) {
        this.$scope = $scope;
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
     * @param {string} courierNumber
     * @param {number} jobId
     */
    async dispatchJobByJobId(courierNumber, jobId) {
        const job = this.DispatchData.getJobDetail(jobId);

        return this.dispatchJob(courierNumber, job);
    }

    /**
     * @param {string} courierNumber
     * @param job
     */
    dispatchJob(courierNumber, job) {
        let foundCourier = this.pickCouriers.find(c => c.id === courierNumber);

        if (foundCourier === undefined) {
            const confirm = this.$mdDialog.confirm()
                .title('Courier Offline')
                .textContent('Dispatch anyway?')
                .ok('Yes')
                .cancel('No');

            this.$mdDialog.show(confirm).then(() => {
                foundCourier = this.$scope.pickAllCouriers.find(c => c.id === courierNumber);
                return this._dispatchJobsContinue(courierNumber, foundCourier, true, job);
            }, () => {
                // user clicked 'No'
            });
            return;
        }

        return this._dispatchJobsContinue(courierNumber, foundCourier, false, job);
    };

    /**
     * @param {string} courierNumber
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

        this.$scope.selectJobDetail(job.id);
        return response;
    }
}

angular.module('uDispatch').service('dispatchJobService', DispatchJobService);
