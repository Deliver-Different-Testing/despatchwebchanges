import "./map-dialog.styles.less"

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
    static $inject = ["$mdDialog", "overviewService", "configService", "delivery"];

    /**
     * @param $mdDialog
     * @param overviewService
     * @param configService
     * @param {OverviewTableParentJob} delivery
     */
    constructor($mdDialog, overviewService, configService, delivery) {
        this.$mdDialog = $mdDialog;
        this.overviewService = overviewService;
        this.configService = configService;
        this.delivery = delivery;

        this.title = `${delivery.jobName} Map`;
        this.loading = true;
        this.selectedJobIndex = 0;

        this.hereCredentials = {
            apiKey: null
        };

        /** @type {MapConfig} */
        this.mapConfig = {
            center: {lat: 39.8097343, lng: -98.5556199},
            zoom: 5,
            job: null,
            selectedJobIndex: 0 // Default to parent job view
        };

        this.loading = false;

        // Initialize the controller
        this.init();
    }

    async init() {
        try {
            // Get API key from backend
            this.hereCredentials.apiKey = await this.configService.getHereMapsKey();

            // Get job data
            this.mapConfig = await this.getJob(this.delivery.jobId);
        } catch (error) {
            console.error("Error initializing map:", error);
            // Handle error appropriately
        } finally {
            this.loading = false;
        }
    }


    /**
     * @param {number} jobId
     */
    async getJob(jobId) {
        return await this.overviewService.getParentJobMap(jobId);
    }

    /**
     * @param {number} index - 0 for parent job, 1+ for child jobs
     */
    switchMapJob(index) {
        console.log(`Setting job on map to ${index === 0 ? "parent" : index}`);
        this.selectedJobIndex = index;
        this.mapConfig.selectedJobIndex = index;
        console.log(this.mapConfig);
    }

    /**
     * Closes the dialog
     */
    cancel() {
        this.$mdDialog.cancel();
    }
}

angular.module("uDispatch").controller("MapDialogController", MapDialogController);
