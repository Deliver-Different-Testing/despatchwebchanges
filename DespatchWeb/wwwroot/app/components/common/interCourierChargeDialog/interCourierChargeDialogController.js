/**
 * @name data
 * @type {object}
 * @property {number} fromCourier - Represents the source courier ID.
 * @property {number} toCourier - Represents the destination courier ID.
 * @property {string} reference - Provides a reference value for the data.
 * @property {number} zones - Represents the number of zones involved in courier service.
 * @property {number} amount - Represents the amount to be paid for the courier service.
 */

class InterCourierChargeDialogController {
    constructor($scope, $mdDialog, DispatchData, toastrService) {
        this.$scope = $scope;
        this.$mdDialog = $mdDialog;
        this.DispatchData = DispatchData;
        this.toastrService = toastrService;

        this.data = {
            fromCourier: 0,
            toCourier: 0,
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

    }

    cancel() {
        this.$mdDialog.cancel();
    }

}
