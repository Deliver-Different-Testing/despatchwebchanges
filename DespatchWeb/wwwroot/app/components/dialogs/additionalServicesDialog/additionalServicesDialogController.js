/**
 * A service for managing additional services for jobs
 * @class
 */
class AdditionalServicesDialogController {
    /**
     * @param $mdDialog
     * @param DispatchData
     * @param toastrService
     * @param {Job} job
     */
    constructor($mdDialog, DispatchData, toastrService, job) {
        this._$mdDialog = $mdDialog;
        this._dispatchData = DispatchData;
        this._toastrService = toastrService;

        // Job Fields
        this._jobId = job.id;
        this._clientId = job.clientId;
        this._speedId = job.speedId;
        this._quantity = job.items;

        let charge = job.charge.replace(/\$/g, "");
        let chargeNumber = parseFloat(charge);

        this.isLoading = false;
        this.isTotalCostCalcuating = false;
        this.totalCost = chargeNumber || 0.0;

        /** @type {ClientItem[]} */
        this.selected = [];

        /** @type {ClientItem} */
        const jobSpeed = {
            itemId: -1,
            clientId: job.clientId,
            name: job.speedName + ' rate',
            description: job.speedName + ' rate',
            perItem: false,
            rate: chargeNumber,
            onlyVan: false,
            selected: true
        };
        this.selected.push(jobSpeed);

        /** @type {ClientItem[]} */
        this.additionalServices = [];
        /** @type {number} */
        this.totalServicesCount = 0;

        this.refreshServices();
        this.addToSelectList = this.addToSelectList.bind(this);
        this.getTotal = this.getTotal.bind(this);
    }

    refreshServices() {
        this.isLoading = true;
        this._dispatchData.getServices(this._clientId, this._speedId, this._jobId).then(serviceResponse => {
            this.additionalServices = serviceResponse.items;
            this.totalServicesCount = serviceResponse.totalCount;

            Array.prototype.push.apply(
                this.selected,
                this.additionalServices.filter(item => item.selected)
            );

            this.isLoading = false;
        });
    }

    addToSelectList() {
        this.isTotalCostCalcuating = true;
        this.getTotal().then(total => {
            this.totalCost = total;
            this.isTotalCostCalcuating = false;
        });
    }

    async getTotal() {
        let totalAmount = this.selected.reduce((total, item) => {
            const itemCharge = item.perItem ? (item.rate * this._quantity) : item.rate;
            return total + itemCharge;
        }, 0.0);
        return this._dispatchData.ppdExclusiveAmount(this._clientId, totalAmount);
    }

    async bookServices() {
        try {
            const serviceIds = this.selected
                .filter(service => service.itemId !== -1)
                .map(service => service.itemId);

            await this._dispatchData.addServicesToJob(this._jobId, serviceIds, this.totalCost);
            this._toastrService.showSuccessToast(serviceIds.length + " total services have been added to job for $" + this.totalCost);

            this._$mdDialog.hide();
        } catch (error) {
            this._toastrService.showErrorToast(error.message);
        }
    }

    cancel() {
        this._$mdDialog.cancel();
    }
}
