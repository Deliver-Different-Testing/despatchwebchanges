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
    constructor($scope, $mdDialog, $http, DispatchData, toastrService, staffId) {
        this.$scope = $scope;
        this.$mdDialog = $mdDialog;
        this.$http = $http;
        this.DispatchData = DispatchData;
        this.toastrService = toastrService;

        this.isLoading = false;

        this.data = {
            fromCourierId: 0,
            toCourierId: 0,
            reference: "",
            zones: 0,
            amount: 0.0,
            staffId
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
        try {
            this.isLoading = true;

            if (!this.courierChargeForm.$valid) {
                this.toastrService.showWarningToast("Please complete all the required fields.");
                this.isLoading = false;
                return;
            }

            // Assign variables from autocompletes
            data.fromCourierId = this.fromCourierSelectedItem.id;
            data.toCourierId = this.toCourierSelectedItem.id;

            const url = "job/InterCourierCharge";
            await this.$http.post(url, data, {headers: {'Content-Type': 'application/json'}});

            this.toastrService.showSuccessToast("Inter-Courier Charge saved successfully");
            this.$mdDialog.hide();
        } catch (error) {
            this.toastrService.showErrorToast(error.message);
        } finally {
            this.isLoading = false;
        }
    }

    cancel() {
        this.$mdDialog.cancel();
    }
}
