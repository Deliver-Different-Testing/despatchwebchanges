/**
 * @typedef {Object} ClientItem
 *
 * @property {number} ItemId - The ID of the item.
 * @property {number} ClientId - The ID of the client that the item belongs to.
 * @property {string} Name - The name of the item.
 * @property {string} Description - The description of the item.
 * @property {boolean} PerItem - True if the rate is calculated per item, otherwise false.
 * @property {number} Rate - The rate associated to the item.
 * @property {boolean} OnlyVan - True if the item should only be delivered by van, otherwise false.
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

        /** @type {ClientItem[]} */
        this.selectedAdditionalServices = [];
        this._getAdditionalServicesForJob(jobId).then(clientJobs => {
            this.selectedAdditionalServices = clientJobs;
        });

        /** @type {ClientItem[]} */
        this.allAdditionalServices = [];
        this._getAllAdditionalServicesForClient(clientId).then(allClientJobs => {
            this.allAdditionalServices = allClientJobs;
        })
    }

    /**
     * @param {number} jobId
     */
    async _getAdditionalServicesForJob(jobId) {
        const url = "job/GetClientItemsForSingleJob/";
        return await this._$http.get(url + '?jobId=' + jobId);
    }

    /**
     * @param {number} clientId
     */
    async _getAllAdditionalServicesForClient(clientId) {
        const url = "job/GetAllClientItems/";
        return await this._$http.get(url + '?clientId=' + clientId);
    }

    cancel() {
        this._$mdDialog.cancel();
    }
}
