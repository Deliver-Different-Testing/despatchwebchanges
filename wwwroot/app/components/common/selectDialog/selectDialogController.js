class SelectDialogController {
    constructor($scope, $mdDialog, DispatchData, id, fieldName, title, job, options) {
        this.$scope = $scope;
        this.$mdDialog = $mdDialog;
        this.DispatchData = DispatchData;

        this.id = id;
        this.title = title;
        this.job = job;
        this.fieldName = fieldName;
        this.field = {
            value: null,
            options: options
        };
    }

    async submit(value) {
        const callData = {
            "call": "updateDetailField",
            "field": this.fieldName,
            "value": value.id,
            "jobID": this.job.id
        };

        this.job.bulkJob ?
            await this.DispatchData.updateBulkJobDetail(this.job.id, callData.field, callData.value, this.job.charge, FirstName, ContactID) :
            await this.DispatchData.updateJobDetail(callData.jobID, callData.field, callData.value, this.job.charge, FirstName, ContactID);

        this.$mdDialog.hide();
    }

    cancel() {
        this.$mdDialog.cancel();
    }
}
