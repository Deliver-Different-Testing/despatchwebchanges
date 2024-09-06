class InterCourierChargeDialog {
    static $inject = [
        '$scope',
        '$mdDialog',
        '$http',
        'DispatchData',
        'toastrService',
        'staffId'
    ];
    constructor($scope, $mdDialog, $http, DispatchData, toastrService, staffId) {
        this._$mdDialog = $mdDialog;
        this._$http = $http;
        this._dispatchData = DispatchData;
        this._toastrService = toastrService;

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
            return await this._dispatchData.autocompleteSearch(searchTerm, url);
        } catch (error) {
            this._toastrService.showErrorToast(error.message);
        }
    }


    /**
     * Updates amount by 7 for each zone.
     *
     * @param {number} zones - The number of zones.
     */
    updateAmountByZones(zones) {
        if (typeof zones !== 'number' || isNaN(zones)) {
            throw new Error('zones must be a valid number');
        }

        this.data.amount = (zones * 7);
    }

    /**
     * @param {InterCourierData} data
     */
    async submit(data) {
        try {
            this.isLoading = true;

            if (!this.courierChargeForm.$valid) {
                this._toastrService.showWarningToast("Please complete all the required fields.");
                this.isLoading = false;
                return;
            }

            // Assign variables from autocompletes
            data.fromCourierId = this.fromCourierSelectedItem.id;
            data.toCourierId = this.toCourierSelectedItem.id;

            const url = "job/InterCourierCharge";
            await this._$http.post(url, data, {headers: {'Content-Type': 'application/json'}});

            this._toastrService.showSuccessToast("Inter-Courier Charge saved successfully");
            this._$mdDialog.hide();
        } catch (error) {
            this._toastrService.showErrorToast(error.message);
        } finally {
            this.isLoading = false;
        }
    }

    cancel() {
        this._$mdDialog.cancel();
    }
}

angular.module('uDispatch').controller('InterCourierChargeDialog', InterCourierChargeDialog);
