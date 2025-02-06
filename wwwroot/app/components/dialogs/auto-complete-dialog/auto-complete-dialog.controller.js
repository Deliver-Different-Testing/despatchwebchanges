/**
 * @fileoverview Controller for the Auto Complete Dialog in the uDispatch application.
 * @module AutoCompleteDialogController
 */

/**
 * Controller for the Auto Complete Dialog
 * @class
 */
class AutoCompleteDialogController {
    /**
     * @type {string[]}
     * @static
     * @description List of dependencies to be injected.
     */
    static $inject = [
        "$mdDialog",
        "DispatchData",
        "toastrService",
        "rateJobService",
        "id",
        "fieldName",
        "title",
        "job",
        "options",
        "existingItem",
        "showRerateOption"
    ];

    /**
     * Create an AutoCompleteDialogController.
     * @param {Object} $mdDialog - The AngularJS Material service for showing dialogs.
     * @param {Object} DispatchData - The service used for data dispatching.
     * @param {Object} toastrService - The service to display toast messages.
     * @param {Object} rateJobService - The service for rating jobs.
     * @param {number} id - The ID related to the selection.
     * @param {string} fieldName - The name of the field for which the selection is being made.
     * @param {string} title - The title of the dialog.
     * @param {Job} job - The job for which the selection is being made.
     * @param {Object} options - The options for autocomplete, including search URL.
     * @param {SelectOption} existingItem - The existing selected item, if any.
     * @param {boolean} showRerateOption - Whether to show the rerate option.
     */
    constructor($mdDialog, DispatchData, toastrService, rateJobService, id, fieldName, title, job, options, existingItem, showRerateOption) {
        this.$mdDialog = $mdDialog;
        this.dispatchData = DispatchData;
        this.toastrService = toastrService;
        this._rateJobService = rateJobService;
        this._job = job;

        /** @type {number} */
        this.id = id;
        /** @type {string} */
        this.fieldName = fieldName;
        /** @type {string} */
        this.title = title;
        /** @type {Object} */
        this.options = options;

        /** @type {boolean} */
        this.isLoading = false;
        /** @type {string} */
        this.searchText = "";
        /** @type {SelectOption|null} */
        this.selectedItem = existingItem;
        /** @type {boolean} */
        this.showRerateOption = showRerateOption;
        /** @type {boolean} */
        this.shouldRerateJob = false;
    }

    /**
     * Method to search query.
     * @param {string} searchTerm - The search term to query.
     * @returns {Promise<SelectOption[]>} A promise that resolves to an array of matching options.
     */
    async querySearch(searchTerm) {
        try {
            const url = this.options.searchUrl;
            return await this.dispatchData.autocompleteSearch(searchTerm, url);
        } catch (error) {
            this.toastrService.showErrorToast(error.message);
        }
    }


    /**
     * Method to submit selected item.
     * @param {SelectOption} selectedOption - The selected option to submit.
     * @returns {Promise<void>}
     */
    async submit(selectedOption) {
        this.isLoading = true;

        try {
            const reRate = this.shouldRerateJob;
            const callData = {
                "call": "updateDetailField",
                "field": this.fieldName,
                "value": selectedOption.id,
                "jobID": this._job.id
            };

            if (reRate && !this._job.bulkJob) {
                const rate = await this._rateJobService.rateJob(this._job);
                await this.dispatchData
                    .updateJobDetail(callData.jobID,
                        callData.field,
                        callData.value,
                        Number(rate.replace(/[^0-9.-]+/g, "")),
                        FirstName,
                        ContactID,
                        this._job.preBook);
            } else {
                this._job.bulkJob ?
                    await this.dispatchData.updateBulkJobDetail(this._job.id, callData.field, callData.value, this._job.charge, FirstName, ContactID) :
                    await this.dispatchData.updateJobDetail(callData.jobID, callData.field, callData.value, this._job.charge, FirstName, ContactID);
            }
        } catch (error) {
            this.toastrService.showErrorToast(error.message);
        } finally {
            this.isLoading = false;

            // Update field
            let fieldName = this.fieldName.toLowerCase();
            let matchingField = Object.keys(this._job).find(key => key.toLowerCase() === fieldName);

            if (matchingField) {
                this._job[matchingField] = selectedOption.id;
            } else {
                console.warn(`Field ${this.fieldName} not found in job object.`);
            }

            if (fieldName === "clientid") {
                this._job.clientName = selectedOption.text;
            }

            this.toastrService.showSuccessToast(this.title + " successfully updated to " + selectedOption.text);
            this.$mdDialog.hide();
        }
    }

    /**
     * Cancel the dialog.
     */
    cancel() {
        this.$mdDialog.cancel();
    }
}

angular.module("uDispatch").controller("AutoCompleteDialogController", AutoCompleteDialogController);
