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

    constructor($mdDialog, overviewService, delivery) {
        this.$mdDialog = $mdDialog;
        this.overviewService = overviewService;
        this.delivery = delivery;

        this.title = `${delivery.jobName} Map`;
        this.loading = true;

        this.hereCredentials = {
            apiKey: 'KedIcK-HWes4X4mqtK64i4jrxTkD7tAWfJdLCXwGPD8'
        };
        this.mapConfig = {
            center: {lat: 39.8097343, lng: -98.5556199},
            zoom: 5,
            job: null,
        };

        // Set up config data
        this.getJob(delivery.jobId).then(data => {
            console.log(data);

            this.mapConfig = data;
            this.loading = false;
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
    selectJob(index) {
        this.selectedJobIndex = index;
        this.mapConfig.selectedIJobIndex = index + 1;
    }


    /**
     * Closes the dialog
     */
    cancel() {
        this.$mdDialog.cancel();
    }
}

angular.module('uDispatch').controller('MapDialogController', MapDialogController);
