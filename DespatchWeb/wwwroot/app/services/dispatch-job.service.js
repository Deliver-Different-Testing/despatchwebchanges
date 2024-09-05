/**
 * A service for dispatching jobs
 * @class
 */
class DispatchJobService {
    static $inject = ['$mdDialog', '$document', 'DispatchData', 'moment'];

    constructor($mdDialog, $document, DispatchData, moment) {
        this.$mdDialog = $mdDialog;
        this.$document = $document;
        this.dispatchData = DispatchData;
        this.moment = moment;

        this.pickCouriers = [];
        this.pickAllCouriers = [];

        this.fetchCouriersData();
    }

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
     * @param {number} courierNumber
     * @param {number} jobId
     */
    async dispatchJobByJobId(courierNumber, jobId) {
        const job = await this.dispatchData.getJobDetail(jobId);
        const selectedCourier = this.pickAllCouriers.find(c => c.courierID === courierNumber);
        await this.dispatchJob(selectedCourier.id, job);
    }

    /**
     * @param {number} courierNumber
     * @param {Job[]} jobs
     */
    async dispatchJobs(courierNumber, jobs) {
        const foundCourier = await this.findCourier(courierNumber);
        if (foundCourier) {
            await this.dispatchJobsContinue(courierNumber, foundCourier, jobs);
        }
    }

    /**
     * @param {number} courierNumber
     * @param {Job} job
     */
    async dispatchJob(courierNumber, job) {
        const foundCourier = await this.findCourier(courierNumber);
        if (foundCourier) {
            await this.dispatchJobsContinue(courierNumber, foundCourier, [job]);
        }
    }

    /**
     * @param {number} courierNumber
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
     * @param {number} courierNumber
     * @param {*} foundCourier
     * @param {Job[]} jobs
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
     * @param {Job} job
     * @param {Courier} courier
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
