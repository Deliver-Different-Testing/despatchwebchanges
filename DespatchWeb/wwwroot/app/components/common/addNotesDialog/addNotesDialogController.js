/**
 * @class
 */
class AddNotesDialogController {
    /**
     * @param {Object} $mdDialog - The AngularJS Material service for showing dialogs.
     * @param {Object} toastrService - The service to display toasters
     * @param {Object} DispatchData - The service used for data dispatching.
     * @param {number|string} id - The ID related to the selection.
     * @param {string} fieldName - The name of the field for which the selection is being made.
     * @param {string} title - The title of the dialog.
     * @param {Job} job - The job for which the selection is being made.
     */
    constructor(
        $mdDialog,
        toastrService,
        DispatchData,
        id,
        fieldName,
        title,
        job) {
        this.$mdDialog = $mdDialog;
        this.DispatchData = DispatchData;
        this.toastrService = toastrService;

        this.isLoading = false;
        this.id = id;
        this.title = title;
        this.job = job;
        this._fieldName = fieldName;
        this.note = "";
    }


    /**
     * @param {string} note
     */
    async submit(note) {
        try {
            this.isLoading = true;

            const callData = {
                "call": "updateDetailField",
                "field": this._fieldName,
                "value": note,
                "jobID": this.job.id
            };

            this.job.bulkJob ?
                await this.DispatchData.addBulkJobNote(this.job.id, callData.value, FirstName, job.preBook)
                : await this.DispatchData.addNote(this.job.id, callData.value, FirstName, this.job.preBook);

            this.toastrService.showSuccessToast("Note added to job successfully");
            this.$mdDialog.hide();
        } catch (error) {
            this.toastrService.showErrorToast(error.message);
        } finally {
            this.isLoading = false;
        }
    }


    /**
     * Cancels the Angular Material Dialog
     */
    cancel() {
        this.$mdDialog.cancel();
    }
}
