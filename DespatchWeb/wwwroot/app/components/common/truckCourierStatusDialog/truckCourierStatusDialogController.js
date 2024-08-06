class TruckCourierStatusDialogController {
    constructor($scope, $mdDialog, DispatchData, toastrService, data) {
        this.$scope = $scope;
        this.$mdDialog = $mdDialog;
        this.DispatchData = DispatchData;
        this.toastrService = toastrService;

        this.data = data;
    }

    /**
     * @param {number} courierId
     */
    async refresh(courierId) {
        try {
            const result = await this.DispatchData.truckCourierStatus(courierId);
            this.$scope.truckCourierStatus = result.data;
            this.data = result.data[0];
        } catch (error) {
            this.toastrService.showErrorToast(error.message);
        }
    }
}
