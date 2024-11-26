/**
 * @fileoverview Controller for the custom map delivery/pickup location dialog
 * @module MapDialogController
 */
class MapDialogController {
    /**
     * @type {string[]}
     * @static
     * @description List of dependencies to be injected.
     */
    static $inject = ['$mdDialog', 'overviewService', 'delivery'];

    /**
     * @param $mdDialog
     * @param overviewService
     * @param {OverviewTableParentJob} delivery
     */
    constructor($mdDialog, overviewService, delivery) {
        this.$mdDialog = $mdDialog;
        this.overviewService = overviewService;
        this.delivery = delivery;

        this.title = `${delivery.jobName} Map`;
        this.loading = true;
        this.selectedJobIndex = 0;

        this.hereCredentials = {
            apiKey: 'KedIcK-HWes4X4mqtK64i4jrxTkD7tAWfJdLCXwGPD8'
        };

        /** @type {MapConfig} */
        this.mapConfig = {
            center: {lat: 39.8097343, lng: -98.5556199},
            zoom: 5,
            job: null,
        };

        this.loading = false;

        // Set up config data
        this.getJob(delivery.jobId).then(data => {
            console.log(data);

            this.mapConfig = data;
        })
    }

    /**
     * @param {number} jobId
     */
    async getJob(jobId) {
        return await this.overviewService.getParentJobMap(jobId);
    }

    /**
     * @param {number} index
     */
    switchMapJob(index) {
        console.log('Setting child job on map to ' + (index + 1));
        this.selectedJobIndex = index;
        this.mapConfig.job.selectedJobIndex = index + 1;
    }

    /**
     * Closes the dialog
     */
    cancel() {
        this.$mdDialog.cancel();
    }
}

angular.module('uDispatch').controller('MapDialogController', MapDialogController);
