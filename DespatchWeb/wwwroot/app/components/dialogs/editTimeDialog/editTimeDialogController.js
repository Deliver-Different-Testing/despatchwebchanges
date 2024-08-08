class EditTimeDialogController {
    static $inject = ["mdpTimePicker"];

    constructor($scope, $mdDialog, DispatchData, mdpTimePicker, toastrService, time, title) {
        this.$scope = $scope;
        this.$mdDialog = $mdDialog;
        this.DispatchData = DispatchData;
        this.mdpTimePicker = mdpTimePicker;
        this.toastrService = toastrService;

        this.isLoading = false;

        // Time to Use
        this.time = time ? time : new Date();
        this.title = title;
        this.message = {
            hour: 'Hour is required',
            minute: 'Minute is required',
        }
    }

    /**
     * @param {Date} time
     */
    async submit(time) {
        try {
            this.isLoading = true;

        } catch (error) {
            this.toastrService.showErrorToast(error.message);
        } finally {
            this.isLoading = false;
        }
    }
}
