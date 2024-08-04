/**
 * A controller which handles the Selection Dialog.
 * @class
 */
class SelectDialogController {
    /**
     * Create a SelectDialogController
     * @param {Object} $mdDialog - The AngularJS Material service for showing dialogs.
     * @param {Object} DispatchData - The service used for data dispatching.
     * @param {number|string} id - The ID related to the selection.
     * @param {string} fieldName - The name of the field for which the selection is being made.
     * @param {string} title - The title of the dialog.
     * @param {Job} job - The job for which the selection is being made.
     * @param {Array} options - The array of selectable options.
     * @param {string} initialValue
     */
    constructor($mdDialog, DispatchData, id, fieldName, title, job, options, initialValue) {
        this.$mdDialog = $mdDialog;
        this.DispatchData = DispatchData;

        this.id = id;
        this.title = title;
        this.job = job;
        this.fieldName = fieldName;
        this.options = options;
        this.selectedOption = null;

        if (initialValue) {
            this.selectedOption = this._findInitialValue(options, initialValue);
        }
    }

    _findInitialValue(options, initialValue) {
        return options.items.find(option => option.text === initialValue) ?? null;
    }

    /**
     * Submits the selected value, updates the job detail, and closes the dialog.
     * @param {Object} value - The selected value from the options.
     */
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


    /**
     * Cancels the Angular Material Dialog
     */
    cancel() {
        this.$mdDialog.cancel();
    }
}
