class TruckCourierStatusDialogController {
    /**
     * Create a SelectDialogController
     * @param $scope
     * @param $mdDialog - The AngularJS Material service for showing dialogs.
     * @param DispatchData - The service used for data dispatching.
     * @param toastrService - The service to display toast messages
     * @param {TruckCourierStatus} data
     */
    constructor($scope, $mdDialog, DispatchData, toastrService, data) {
        this._$scope = $scope;
        this._$mdDialog = $mdDialog;
        this._dispatchData = DispatchData;
        this._toastrService = toastrService;

        this.data = data;
    }

    /**
     * @param {number} courierId
     */
    async refresh(courierId) {
        try {
            const result = await this._dispatchData.truckCourierStatus(courierId);
            this._$scope.truckCourierStatus = result.data;
            this.data = result.data[0];
        } catch (error) {
            this._toastrService.showErrorToast(error.message);
        }
    }

    cancel() {
        this._$mdDialog.cancel();
    }
}
