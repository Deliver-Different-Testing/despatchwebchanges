/**
 * A service for managing additional services for jobs
 * @class
 */
class AdditionalServicesDialogController {
    static $inject = ['$mdDialog', 'DispatchData', 'toastrService', 'job'];

    /**
     * @param {Object} $mdDialog - AngularJS material dialog service
     * @param {Object} DispatchData - Service for dispatch operations
     * @param {Object} toastrService - Service for displaying toast notifications
     * @param {Job} job - The job object
     */
    constructor($mdDialog, DispatchData, toastrService, job) {
        this.$mdDialog = $mdDialog;
        this.dispatchData = DispatchData;
        this.toastrService = toastrService;
        this.job = job;

        this.initializeState();
        this.bindMethods();
        this.refreshServices().catch(error => {
            this.toastrService.showErrorToast("Error initializing services: " + error.message);
        });
    }

    initializeState() {
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

    bindMethods() {
        this.addToSelectList = this.addToSelectList.bind(this);
        this.getTotal = this.getTotal.bind(this);
    }

    setTotalCost(charge) {
        const cleanedCharge = charge.replace(/\$/g, "");
        this.totalCost = parseFloat(cleanedCharge) || 0.0;
    }

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

    async getTotal() {
        const totalAmount = this.selected.reduce((total, item) => {
            const itemCharge = item.perItem ? (item.rate * this.quantity) : item.rate;
            return total + itemCharge;
        }, 0.0);
        return this.dispatchData.ppdExclusiveAmount(this.clientId, totalAmount);
    }

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

    cancel() {
        this.$mdDialog.cancel();
    }
}

angular.module('uDispatch').controller('AdditionalServicesDialogController', AdditionalServicesDialogController);
