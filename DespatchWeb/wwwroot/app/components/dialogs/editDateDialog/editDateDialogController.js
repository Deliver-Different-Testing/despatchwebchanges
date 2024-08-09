class EditDateDialogController {
    /**
     * @param $scope - The AngualrJS $scope directive
     * @param $mdDialog - The AngularJS Material service for showing dialogs.
     * @param toastrService - The service to display toast messages
     * @param DispatchData - The Home Service
     * @param moment - The AngularJS directive to interact with momentjs
     * @param {Job} job
     * @param {string} id - The ID related to the selection.
     * @param {string} fieldName - The name of the field for which the selection is being made.
     * @param {string} title - The title of the dialog.
     * @param {Date} date - The date to edit
     */
    constructor($scope, $mdDialog, toastrService, DispatchData, moment, job, title, fieldName, date, id) {
        this.$scope = $scope;
        this.$mdDialog = $mdDialog;
        this.toastrService = toastrService;
        this.DispatchData = DispatchData;

        this._job = job;
        this.title = title;
        this.fieldName = fieldName;
        this.date = moment(date, "DD/MM/YYYY").toDate();
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
            "jobID": this._job.id
        };

        if (this._job.bulkJob) {
            await this.DispatchData
                .updateBulkJobDetail(
                    this._job.id,
                    callData.field,
                    callData.value,
                    this._job.charge,
                    FirstName,
                    ContactID);
        } else {
            await this.DispatchData
                .updateJobDetail(
                    this._job.id,
                    callData.field,
                    callData.value,
                    this._job.charge,
                    FirstName,
                    ContactID,
                    this._job.preBook);
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
