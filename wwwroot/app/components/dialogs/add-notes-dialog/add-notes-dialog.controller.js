/**
 * @fileoverview Controller for the Add Notes Dialog in the uDispatch application.
 * @module AddNotesDialogController
 */
class AddNotesDialogController {
    /**
     * @type {string[]}
     * @static
     * @description List of dependencies to be injected.
     */
    static $inject = ["$mdDialog", "toastrService", "DispatchData", "id", "fieldName", "title", "job"];

    /**
     * Create an AddNotesDialogController.
     * @param {Object} $mdDialog - The AngularJS Material service for showing dialogs.
     * @param {Object} toastrService - The service to display toasters.
     * @param {Object} DispatchData - The service used for data dispatching.
     * @param {string} id - The ID related to the selection.
     * @param {string} fieldName - The name of the field for which the selection is being made.
     * @param {string} title - The title of the dialog.
     * @param {Job} job - The job for which the selection is being made.
     */
    constructor($mdDialog, toastrService, DispatchData, id, fieldName, title, job) {
        this.$mdDialog = $mdDialog;
        this.dispatchData = DispatchData;
        this.toastrService = toastrService;

        /** @type {boolean} */
        this.isLoading = false;
        /** @type {string} */
        this.id = id;
        /** @type {string} */
        this.title = title;
        /** @type {Job} */
        this._job = job;
        /** @type {string} */
        this._fieldName = fieldName;

        // Notes field
        if (this._fieldName === "Note") {
            this.note = job.internalNotes;
        } else if (this._fieldName === "ConNote") {
            this.note = job.conNote;
        } else {
            this.note = "";
        }
    }

    /**
     * Submit the note.
     * @param {string} note - The note to be submitted.
     * @returns {Promise<void>}
     */
    async submit(note) {
        try {
            this.isLoading = true;
            if (this._fieldName === "Note") {
                await this.addJobNote(this._job.id, note, FirstName, this._job.preBook, this._job.bulkJob);
                this._job.internalNotes = note;
            } else if (this._fieldName === "ConNote") {
                await this.dispatchData.addConNote(this._job.id, note);
                this._job.conNote = note;
            } else {
                // Other type of notes
                const callData = {
                    "call": "updateDetailField",
                    "field": this._fieldName,
                    "value": note,
                    "jobID": this._job.id
                };

                await this.updateJobDetail(this._job.bulkJob, callData.jobID, callData.field, callData.value, this._job.charge, FirstName, ContactID, this._job.preBook);
                this._job[this._fieldName] = note;
            }

            this.toastrService.showSuccessToast("Note saved");
            this.$mdDialog.hide(this._job);
        } catch (error) {
            this.toastrService.showErrorToast(error.message);
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * Add a note to the job.
     * @param {number} id - The ID of the job.
     * @param {string} note - The note to be added.
     * @param {string} firstName - The first name of the user adding the note.
     * @param {boolean} preBook - Indicates if the job is pre-booked.
     * @param {boolean} bulkJob - Indicates if it's a bulk job.
     * @returns {Promise<void>}
     */
    async addJobNote(id, note, firstName, preBook, bulkJob) {
        if (bulkJob) {
            await this.dispatchData.addBulkJobNote(id, note, firstName, preBook);
        } else {
            await this.dispatchData.addNote(id, note, firstName, preBook);
        }
    }

    /**
     * Update job details.
     * @param {boolean} bulkJob - Indicates if it's a bulk job.
     * @param {number} jobID - The ID of the job.
     * @param {string} field - The field to be updated.
     * @param {string} value - The new value for the field.
     * @param {number} charge - The charge associated with the job.
     * @param {string} firstName - The first name of the user updating the job.
     * @param {string} contactID - The contact ID.
     * @param {boolean} preBook - Indicates if the job is pre-booked.
     * @returns {Promise<void>}
     */
    async updateJobDetail(bulkJob, jobID, field, value, charge, firstName, contactID, preBook) {
        if (bulkJob) {
            await this.dispatchData.updateBulkJobDetail(jobID, field, value, charge, firstName, contactID);
        } else {
            await this.dispatchData.updateJobDetail(jobID, field, value, charge, firstName, contactID, preBook);
        }
    }


    /**
     * Cancels the Angular Material Dialog.
     */
    cancel() {
        this.$mdDialog.cancel();
    }
}

angular.module("uDispatch").controller("AddNotesDialogController", AddNotesDialogController);
