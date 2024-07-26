/**
 * @name data
 * @type {object}
 * @property {number} fromCourierId - Represents the source courier ID.
 * @property {number} toCourierId - Represents the destination courier ID.
 * @property {string} reference - Provides a reference value for the data.
 * @property {number} zones - Represents the number of zones involved in courier service.
 * @property {number} amount - Represents the amount to be paid for the courier service.
 */

class InterCourierChargeDialogController {
    constructor($scope, $mdDialog, $http, DispatchData, toastrService) {
        this.$scope = $scope;
        this.$mdDialog = $mdDialog;
        this.$http = $http;
        this.DispatchData = DispatchData;
        this.toastrService = toastrService;

        this.data = {
            fromCourierId: 0,
            toCourierId: 0,
            reference: "",
            zones: 0,
            amount: 0.0
        }

        this.courierChargeForm = $scope.courierChargeForm;
        this.fromCourierSearchText = "";
        this.toCourierSearchText = "";

        this.fromCourierSelectedItem = null;
        this.toCourierSelectedItem = null;
    }

    /**
     * @param {string} searchTerm
     */
    async courierSearch(searchTerm) {
        try {
            const url = "/courier/AllActiveSearch";
            return await this.DispatchData.autocompleteSearch(searchTerm, url);
        } catch (error) {
            this.toastrService.showErrorToast(error.message);
        }
    }

    /**
     * @param {data} data
     */
    async submit(data) {
        // Assign variables from autocompletes
        data.fromCourierId = this.fromCourierSelectedItem.id;
        data.toCourierId = this.toCourierSelectedItem.id;

        const url = "job/InterCourierCharge";
        this.$http.post(url, data, {headers: {'Content-Type': 'application/json'}});
    }

    cancel() {
        this.$mdDialog.cancel();
    }

}
