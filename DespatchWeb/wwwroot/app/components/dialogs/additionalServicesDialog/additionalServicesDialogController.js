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
    /**
     * @param $mdDialog
     * @param $http
     * @param {number} jobId
     * @param {number} clientId
     */
    constructor($mdDialog, $http, jobId, clientId) {
        this._$mdDialog = $mdDialog;
        this._$http = $http;

        this.selected = [];
        this.isLoading = false;

        /** @type {Query} */
        this.query = {
            order: 'name', limit: 5, page: 1
        };

        /** @type {ClientItem[]} */
        this.allJobAdditionalServices = [];

        /** @type {ClientItem[]} */
        this.allClientAdditionalServices = [];

        /** @type {ClientItem[]} */
        this.tableList = [];

        // Get Data
        this._getAdditionalServicesForJob(jobId).then(services => {
            this.allJobAdditionalServices = services;

            // Update Table
            this.updateTable();
        });

        this._getAllAdditionalServicesForClient(clientId).then(allClientServices => {
            this.allClientAdditionalServices = allClientServices;
        });
    }

    /**
     * @param {number} jobId
     */
    async _getAdditionalServicesForJob(jobId) {
        const url = "job/GetClientItemsForSingleJob/";
        const response = await this._$http.get(`${url}?jobId=${jobId}`);
        return response.data;
    }

    /**
     * @param {number} clientId
     */
    async _getAllAdditionalServicesForClient(clientId) {
        const url = "job/GetAllClientItems/";
        const response = await this._$http.get(`${url}?clientId=${clientId}`);
        return response.data;
    }

    updateTable() {
        const jobServices = this.allJobAdditionalServices;
        const query = this.query;

        // Sort by order
        jobServices.sort((a, b) => a[query.order] > b[query.order] ? 1 : -1);

        const startIndex = (query.page - 1) * query.limit;
        const endIndex = startIndex + query.limit;

        this.tableList = jobServices.slice(startIndex, endIndex);
    }

    async addService() {
        // Add the service to the all job services list
    }

    async bookServices(allJobServices) {
        // Add the services to the job here
    }

    cancel() {
        this._$mdDialog.cancel();
    }
}
