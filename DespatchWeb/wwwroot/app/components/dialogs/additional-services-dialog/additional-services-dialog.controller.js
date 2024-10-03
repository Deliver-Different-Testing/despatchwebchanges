/**
 * @fileoverview Controller for managing additional services for jobs in the uDispatch application.
 * @module AdditionalServicesDialogController
 */

/**
 * Controller for managing additional services for jobs
 * @class
 */
class AdditionalServicesDialogController {
    /**
     * @type {string[]}
     * @static
     * @description List of dependencies to be injected.
     */
    static $inject = ['$mdDialog', 'DispatchData', 'toastrService', 'job'];

    /**
     * Create an AdditionalServicesDialogController.
     * @param {Object} $mdDialog - AngularJS material dialog service.
     * @param {Object} DispatchData - Service for dispatch operations.
     * @param {Object} toastrService - Service for displaying toast notifications.
     * @param {Job} job - The job object.
     */
    constructor($mdDialog, DispatchData, toastrService, job) {
        this.$mdDialog = $mdDialog;
        this.dispatchData = DispatchData;
        this.toastrService = toastrService;
        this.job = job;

        this._initializeState();
        this._bindMethods();
        this.refreshServices().catch(error => {
            this.toastrService.showErrorToast("Error initializing services: " + error.message);
        });
    }

    /**
     * Initialize the state of the controller.
     * @private
     */
    _initializeState() {
        this.jobId = this.job.id;
        this.clientId = this.job.clientId;
        this.speedId = this.job.speedId;
        this.quantity = this.job.items;

        this.isLoading = false;
        this.isTotalCostCalculating = false;
        this.selected = [];
        this.additionalServices = [];
        this.totalServicesCount = 0;

        this.setTotalCost(this.job.charge);
        this.addJobSpeedToSelected();
    }

    /**
     * Bind methods to ensure correct 'this' context.
     * @private
     */
    _bindMethods() {
        this.addToSelectList = this.addToSelectList.bind(this);
        this.getTotal = this.getTotal.bind(this);
    }

    /**
     * Set the total cost based on the job charge.
     * @param {Number} charge - The job charge.
     */
    setTotalCost(charge) {
        const cleanedCharge = charge.replace(/\$/g, "");
        this.totalCost = parseFloat(cleanedCharge) || 0.0;
    }

    /**
     * Add the job speed to the selected services.
     */
    addJobSpeedToSelected() {
        const jobSpeed = {
            itemId: -1,
            clientId: this.job.clientId,
            name: `${this.job.speedName} rate`,
            description: `${this.job.speedName} rate`,
            perItem: false,
            rate: this.totalCost,
            onlyVan: false,
            selected: true
        };

        this.selected.push(jobSpeed);
    }

    /**
     * Refresh the list of available services.
     * @returns {Promise<void>}
     */
    async refreshServices() {
        this.isLoading = true;
        try {
            const serviceResponse = await this.dispatchData.getServices(this.clientId, this.speedId, this.jobId);
            this.additionalServices = serviceResponse.items;
            this.totalServicesCount = serviceResponse.totalCount;

            this.selected.push(...this.additionalServices.filter(item => item.selected));
        } catch (error) {
            this.toastrService.showErrorToast("Error fetching services: " + error.message);
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * Add selected services to the list and recalculate total cost.
     * @returns {Promise<void>}
     */
    async addToSelectList() {
        this.isTotalCostCalculating = true;
        try {
            this.totalCost = await this.getTotal();
        } catch (error) {
            this.toastrService.showErrorToast("Error calculating total: " + error.message);
        } finally {
            this.isTotalCostCalculating = false;
        }
    }

    /**
     * Calculate the total cost of selected services.
     * @returns {Promise<number>} The total cost.
     */
    async getTotal() {
        const totalAmount = this.selected.reduce((total, item) => {
            const itemCharge = item.perItem ? (item.rate * this.quantity) : item.rate;
            return total + itemCharge;
        }, 0.0);
        return this.dispatchData.ppdExclusiveAmount(this.clientId, totalAmount);
    }

    /**
     * Book the selected services for the job.
     * @returns {Promise<void>}
     */
    async bookServices() {
        try {
            const serviceIds = this.selected
                .filter(service => service.itemId !== -1)
                .map(service => service.itemId);

            await this.dispatchData.addServicesToJob(this.jobId, serviceIds, this.totalCost);
            this.toastrService.showSuccessToast(`${serviceIds.length} total services have been added to job for $${this.totalCost}`);

            this.job.charge = this.totalCost;

            this.$mdDialog.hide();
        } catch (error) {
            this.toastrService.showErrorToast(error.message);
        }
    }

    /**
     * Cancel the dialog.
     */
    cancel() {
        this.$mdDialog.cancel();
    }
}

angular.module('uDispatch').controller('AdditionalServicesDialogController', AdditionalServicesDialogController);
