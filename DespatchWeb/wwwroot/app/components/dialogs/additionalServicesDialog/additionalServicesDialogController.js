/**
 * @typedef {Object} ClientItem
 *
 * @property {number} itemId - The ID of the item.
 * @property {number} clientId - The ID of the client that the item belongs to.
 * @property {string} name - The name of the item.
 * @property {string} description - The description of the item.
 * @property {boolean} perItem - True if the rate is calculated per item, otherwise false.
 * @property {number} rate - The rate associated to the item.
 * @property {boolean} onlyVan - True if the item should only be delivered by van, otherwise false.
 */

/**
 * @typedef {Object} Query
 *
 * @property {string} order
 * @property {number} limit
 * @property {number} page
 */

class AdditionalServicesDialogController {
    jobId;

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
