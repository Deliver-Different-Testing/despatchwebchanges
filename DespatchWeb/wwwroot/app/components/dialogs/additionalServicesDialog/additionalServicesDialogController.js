/**
 * A service for manageing additional services for jobs
 * @class
 */
class AdditionalServicesDialogController {
    /**
     * @param $mdDialog
     * @param $http
     * @param {number} jobId
     * @param {number} clientId
     * @param {number} speedId
     */
    constructor($mdDialog, $http, jobId, clientId, speedId) {
        this._$mdDialog = $mdDialog;
        this._$http = $http;
        this._jobId = jobId;
        this._clientId = clientId;
        this._speedId = speedId;

        this.isLoading = false;

        /** @type {Query} */
        this.query = {
            order: 'name', limit: 5, page: 1
        };

        /** @type {ClientItem[]} */
        this.additionalServices = [];
        this.totalServicesCount = 0;
        this.getServices(clientId, speedId, jobId, this.query).then(serviceResponse => {
            this.additionalServices = serviceResponse.items;
            this.totalServicesCount = serviceResponse.totalCount;
        });
    }

    async getServices() {
        const url = "job/GetAllClientItemsBySpeed";
        let response = await this._$http.get(url + '?clientId=' + this._clientId + '&speedId=' + this._speedId + '&jobId=' + this._jobId
            + '&pageNumber=' + this.query.limit + '&pageSize=' + this.query.page);

        return response.data;
    }

    getTotal() {
        return 1;
    }

    async bookServices(allJobServices) {
        // Add the services to the job here
    }

    cancel() {
        this._$mdDialog.cancel();
    }
}
