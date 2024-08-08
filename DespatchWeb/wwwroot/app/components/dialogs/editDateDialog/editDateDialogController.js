class EditDateDialogController {
    /**
     * @param {Object} $scope - The AngualrJS $scope directive
     * @param {Object} $mdDialog - The AngularJS Material service for showing dialogs.
     * @param {Object} toastrService - The service to display toast messages
     * @param {Object} DispatchData - The Home Service
     * @param {string} id - The ID related to the selection.
     * @param {string} fieldName - The name of the field for which the selection is being made.
     * @param {string} title - The title of the dialog.
     * @param {Date} date - The date to edit
     */
    constructor($scope, $mdDialog, toastrService, DispatchData, title, fieldName, date, id) {
        this.$scope = $scope;
        this.$mdDialog = $mdDialog;
        this.toastrService = toastrService;
        this.DispatchData = DispatchData;
        this.title = title;
        this.fieldName = fieldName;
        this.date = date;
        this.id = id;

        this.isLoading = false;
    }

    /**
     * @param {Date} newDate
     */
    async submit(newDate) {
        try {
            this.isLoading = true;
            await this.updateJobDetail(newDate);
        } catch (error) {
            this.toastrService.showErrorToast(error.message);
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * @param {Date} newDate
     */
    async updateJobDetail(newDate) {
        const formattedDate = this._formatDate(newDate);
        const callData = {
            "call": "updateDetailField",
            "field": this.fieldName,
            "value": formattedDate,
            "jobID": this.job.id
        };

        if (this.job.bulkJob) {
            await this.DispatchData
                .updateBulkJobDetail(
                    this.job.id,
                    callData.field,
                    callData.value,
                    this.job.charge,
                    FirstName,
                    ContactID);
        } else {
            await this.DispatchData
                .updateJobDetail(
                    this.job.id,
                    callData.field,
                    callData.value,
                    this.job.charge,
                    FirstName,
                    ContactID,
                    this.job.preBook);
        }

        this.showMessageAndCloseDialog();
    }

    showMessageAndCloseDialog() {
        this.toastrService.showSuccessToast("Updated " + this.title);
        this.$mdDialog.hide();
    }

    /**
     * @param date
     */
    _formatDate(date) {
        return new Date(moment(date).format("YYYY-MM-DDTHH:mm"))
    }

    cancel() {
        this.$mdDialog.cancel();
    }
}
