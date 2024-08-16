/**
 * A service for managing additional services for jobs
 * @class
 */
class AdditionalServicesDialogController {
    /**
     * @param $mdDialog
     * @param $http
     * @param toastrService
     * @param {number} jobId
     * @param {number} clientId
     * @param {number} speedId
     */
    constructor($mdDialog, $http, toastrService, jobId, clientId, speedId) {
        this._$mdDialog = $mdDialog;
        this._$http = $http;
        this._toastrService = toastrService;
        this._jobId = jobId;
        this._clientId = clientId;
        this._speedId = speedId;

        this.isLoading = false;
        this.promise = null;
        this.selected = [];

        /** @type {ClientItem[]} */
        this.additionalServices = [];

        /** @type {number} */
        this.totalServicesCount = 0;

        this.refreshServices();
    }

    async _getServices() {
        const url = "job/GetAllClientItems";
        let response = await this._$http.get(url + '?clientId=' + this._clientId + '&speedId=' + this._speedId + '&jobId=' + this._jobId);

        return response.data;
    }

    refreshServices() {
        this.isLoading = true;
        this._getServices().then(serviceResponse => {
            this.additionalServices = serviceResponse.items;
            this.totalServicesCount = serviceResponse.totalCount;

            this.isLoading = false;
        });
    }

    /**
     * @param {ClientItem} selectedService
     */
    addToSelectList(selectedService) {
        this.selected.push(selectedService);
    }

    getTotal() {
        return 1;
    }

    /**
     * @param {ClientItem[]} allJobServices
     */
    async bookServices(allJobServices) {
        try {
            const serviceIds = allJobServices
                .filter(service => service.selected)
                .map(service => service.itemId);

            const url = "job/AddClientItemsTobJob"

            await this._$http({
                method: 'POST', url: url + '?jobId=' + this._jobId, data: serviceIds
            });

            this._toastrService.showSuccessToast(serviceIds.length + " total services have been added to Job");
        } catch (error) {
            this._toastrService.showErrorToast(error.message);
        }
    }

    cancel() {
        this._$mdDialog.cancel();
    }
}
