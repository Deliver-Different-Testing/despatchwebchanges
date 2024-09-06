/**
 * @class
 */
class AddNotesDialogController {
    static $inject = ['$mdDialog', 'toastrService', 'DispatchData', 'id', 'fieldName', 'title', 'job'];

    /**
     * @param $mdDialog - The AngularJS Material service for showing dialogs.
     * @param toastrService - The service to display toasters
     * @param DispatchData - The service used for data dispatching.
     * @param {string} id - The ID related to the selection.
     * @param {string} fieldName - The name of the field for which the selection is being made.
     * @param {string} title - The title of the dialog.
     * @param {Job} job - The job for which the selection is being made.
     */
    constructor($mdDialog, toastrService, DispatchData, id, fieldName, title, job) {
        this._$mdDialog = $mdDialog;
        this._dispatchData = DispatchData;
        this._toastrService = toastrService;

        this.isLoading = false;
        this.id = id;
        this.title = title;
        this._job = job;
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
                await this.addJobNote(this._job.id, note, FirstName, this._job.preBook, this._job.bulkJob);
            } else {
                // Other type of notes
                const callData = {
                    "call": "updateDetailField",
                    "field": this._fieldName,
                    "value": note,
                    "jobID": this._job.id
                };
                await this.updateJobDetail(this._job.bulkJob, callData.jobID, callData.field, callData.value, this._job.charge, FirstName, ContactID, this._job.preBook);
            }

            this._job.internalNotes = note + '\n' + this._job.internalNotes;
            this._toastrService.showSuccessToast("Added Note To Job");
            this._$mdDialog.hide(this._job);
        } catch (error) {
            this._toastrService.showErrorToast(error.message);
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
            await this._dispatchData.addBulkJobNote(id, note, firstName, preBook);
        } else {
            await this._dispatchData.addNote(id, note, firstName, preBook);
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
            await this._dispatchData.updateBulkJobDetail(jobID, field, value, charge, firstName, contactID);
        } else {
            await this._dispatchData.updateJobDetail(jobID, field, value, charge, firstName, contactID, preBook);
        }
    }


    /**
     * Cancels the Angular Material Dialog
     */
    cancel() {
        this._$mdDialog.cancel();
    }
}

angular.module('uDispatch').controller('AddNotesDialogController', AddNotesDialogController);
