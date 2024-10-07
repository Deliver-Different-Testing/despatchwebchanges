/**
 * @class InterCourierChargeDialog
 * @description Controller for the Inter-Courier Charge dialog in the uDispatch Angular module.
 * This controller handles the logic for creating and submitting inter-courier charges.
 */
class InterCourierChargeDialog {
    /**
     * @type {string[]}
     * @static
     * @description List of dependencies to be injected.
     */
    static $inject = [
        '$scope',
        '$mdDialog',
        '$http',
        'DispatchData',
        'toastrService',
        'staffId'
    ];

    /**
     * @constructor
     * @param {object} $scope - Angular scope object.
     * @param {object} $mdDialog - The AngularJS Material service for showing dialogs.
     * @param {object} $http - Angular's $http service for making HTTP requests.
     * @param {object} DispatchData - Service for dispatch-related data operations.
     * @param {object} toastrService - Service to display toast messages.
     * @param {number} staffId - ID of the staff member creating the charge.
     */
    constructor($scope, $mdDialog, $http, DispatchData, toastrService, staffId) {
        this._$mdDialog = $mdDialog;
        this._$http = $http;
        this._dispatchData = DispatchData;
        this._toastrService = toastrService;

        this.isLoading = false;

        /**
         * @typedef {Object} Data
         *
         * @property {number} fromCourierId - ID of the courier charging.
         * @property {number} toCourierId - ID of the courier being charged.
         * @property {string} reference - Reference for the charge.
         * @property {number} zones - Number of zones for the charge.
         * @property {number} amount - Amount of the charge.
         * @property {number} staffId - ID of the staff member creating the charge.
         */
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
     * Searches for couriers based on the provided search term.
     * @param {string} searchTerm - The term to search for.
     * @returns {Promise<Array>} A promise that resolves to an array of courier search results.
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
     * @param {number} zones - The number of zones.
     * @throws {Error} If zones is not a valid number.
     */
    updateAmountByZones(zones) {
        if (typeof zones !== 'number' || isNaN(zones)) {
            throw new Error('zones must be a valid number');
        }

        this.data.amount = (zones * 7);
    }

    /**
     * Submits the inter-courier charge data.
     * @param {Data} data - The inter-courier charge data to submit.
     * @returns {Promise<void>}
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

    /**
     * Cancels the dialog operation.
     */
    cancel() {
        this._$mdDialog.cancel();
    }
}

angular.module('uDispatch').controller('InterCourierChargeDialog', InterCourierChargeDialog);
