/**
 * @class TruckCourierStatusDialogController
 * @description A controller for managing truck courier status dialog in the uDispatch Angular module.
 */
class TruckCourierStatusDialogController {
    /**
     * @type {string[]}
     * @static
     * @description List of dependencies to be injected.
     */
    static $inject = [
        "$mdDialog",
        "DispatchData",
        "toastrService",
        "data"
    ];

    /**
     * Creates an instance of TruckCourierStatusDialogController.
     * @constructor
     * @param {Object} $mdDialog - The AngularJS Material service for showing dialogs.
     * @param {Object} DispatchData - The service used for data dispatching.
     * @param {Object} toastrService - The service to display toast messages.
     * @param {Object} data - The initial truck courier status data.
     * @property {Object} data - The current truck courier status data.
     */
    constructor($mdDialog, DispatchData, toastrService, data) {
        this.$mdDialog = $mdDialog;
        this.dispatchData = DispatchData;
        this.toastrService = toastrService;
        this.data = data;
    }

    /**
     * Refreshes the truck courier status data for a specific courier.
     * @async
     * @param {number} courierId - The ID of the courier to refresh status for.
     * @returns {Promise<void>}
     */
    async refresh(courierId) {
        try {
            const result = await this.dispatchData.truckCourierStatus(courierId);
            this.data = result.data[0];
        } catch (error) {
            this.toastrService.showErrorToast(error.message);
        }
    }

    /**
     * Cancels the dialog operation.
     */
    cancel() {
        this.$mdDialog.cancel();
    }
}

angular.module("uDispatch").controller("TruckCourierStatusDialogController", TruckCourierStatusDialogController);
