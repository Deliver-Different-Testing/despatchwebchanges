/**
 * A service for managing additional services for jobs
 * @class
 */
class AdditionalServicesDialogController {
    /**
     * @param $mdDialog
     * @param DispatchData
     * @param toastrService
     * @param {number} jobId
     * @param {number} clientId
     * @param {number} speedId
     * @param {number} quantity
     */
    constructor($mdDialog, DispatchData, toastrService, jobId, clientId, speedId, quantity) {
        this._$mdDialog = $mdDialog;
        this._dispatchData = DispatchData;
        this._toastrService = toastrService;
        this._jobId = jobId;
        this._clientId = clientId;
        this._speedId = speedId;
        this._quantity = quantity;

        this.isLoading = false;
        this.promise = null;
        this.totalCost = 0;

        /** @type {ClientItem[]} */
        this.selected = [];

        /** @type {ClientItem[]} */
        this.additionalServices = [];

        /** @type {number} */
        this.totalServicesCount = 0;

        this.refreshServices();
    }

    refreshServices() {
        this.isLoading = true;
        this._dispatchData.getServices(this._clientId, this._speedId, this._jobId).then(serviceResponse => {
            this.additionalServices = serviceResponse.items;
            this.totalServicesCount = serviceResponse.totalCount;

            this.isLoading = false;
        });
    }

    /**
     * @param {ClientItem} selectedService
     */
    async addToSelectList(selectedService) {
        this.selected.push(selectedService);
        await this.getTotal();
    }

    async getTotal() {
        const totalAmount = this.selected.reduce((total, item) => {
            const itemCharge = item.perItem ? (item.rate * this._quantity) : item.rate;
            return total + itemCharge;
        }, 0.0);

        this.totalCost = await this._dispatchData.ppdExclusiveAmount(this._clientId, totalAmount);
    }

    async bookServices() {
        try {
            const selectedServiceIds = this.selected.filter(service => service.selected).map(service => service.itemId);
            await this._dispatchData.addServicesToJob(this._jobId, selectedServiceIds);

            const successMessage = `${selectedServiceIds.length} total services have been added to job for ${this.totalCost}`;
            this._toastrService.showSuccessToast(successMessage);
        } catch (error) {
            this._toastrService.showErrorToast(error.message);
        }
    }

    cancel() {
        this._$mdDialog.cancel();
    }
}
