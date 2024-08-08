/**
 * @class
 */
class AddNotesDialogController {
    /**
     * @param {Object} $mdDialog - The AngularJS Material service for showing dialogs.
     * @param {Object} toastrService - The service to display toasters
     * @param {Object} DispatchData - The service used for data dispatching.
     * @param {string} id - The ID related to the selection.
     * @param {string} fieldName - The name of the field for which the selection is being made.
     * @param {string} title - The title of the dialog.
     * @param {Job} job - The job for which the selection is being made.
     */
    constructor($mdDialog, toastrService, DispatchData, id, fieldName, title, job) {
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
            if (this._fieldName === "Notes") {
                await this.addJobNote(this.job.id, note, FirstName, this.job.preBook, this.job.bulkJob);
            } else {
                // Other type of notes
                const callData = {
                    "call": "updateDetailField",
                    "field": this._fieldName,
                    "value": note,
                    "jobID": this.job.id
                };
                await this.updateJobDetail(this.job.bulkJob, callData.jobID, callData.field, callData.value, this.job.charge, FirstName, ContactID, this.job.preBook);
            }
            this.toastrService.showSuccessToast("Added Note To Job");
            this.$mdDialog.hide();
        } catch (error) {
            this.toastrService.showErrorToast(error.message);
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * @param {number} id
     * @param {string} note
     * @param {string} firstName
     * @param {boolean} preBook
     * @param {boolean} bulkJob
     */
    async addJobNote(id, note, firstName, preBook, bulkJob) {
        if (bulkJob) {
            await this.DispatchData.addBulkJobNote(id, note, firstName, preBook);
        } else {
            await this.DispatchData.addNote(id, note, firstName, preBook);
        }
    }

    /**
     * @param {string} firstName
     * @param {number} jobID
     * @param {string} field
     * @param {string} value
     * @param {number} charge
     * @param {string} contactID
     * @param {boolean} preBook
     * @param {boolean} bulkJob
     */
    async updateJobDetail(bulkJob, jobID, field, value, charge, firstName, contactID, preBook) {
        if (bulkJob) {
            await this.DispatchData.updateBulkJobDetail(jobID, field, value, charge, firstName, contactID);
        } else {
            await this.DispatchData.updateJobDetail(jobID, field, value, charge, firstName, contactID, preBook);
        }
    }


    /**
     * Cancels the Angular Material Dialog
     */
    cancel() {
        this.$mdDialog.cancel();
    }
}
