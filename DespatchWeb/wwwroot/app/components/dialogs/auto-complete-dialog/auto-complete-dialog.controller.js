class AutoCompleteDialogController {
    static $inject = [
        '$mdDialog',
        'DispatchData',
        'toastrService',
        'rateJobService',
        'id',
        'fieldName',
        'title',
        'job',
        'options',
        'existingItem',
        'showRerateOption'
    ];

    /**
     * Create a SelectDialogController
     * @param $mdDialog - The AngularJS Material service for showing dialogs.
     * @param DispatchData - The service used for data dispatching.
     * @param toastrService - The service to display toast messages
     * @param rateJobService
     * @param {number} id - The ID related to the selection.
     * @param {string} fieldName - The name of the field for which the selection is being made.
     * @param {string} title - The title of the dialog.
     * @param {Job} job - The job for which the selection is being made.
     * @param {SelectOption[]} options - The array of selectable options.
     * @param existingItem
     * @param {boolean} showRerateOption
     */
    constructor($mdDialog, DispatchData, toastrService, rateJobService, id, fieldName, title, job, options, existingItem, showRerateOption) {
        this._$mdDialog = $mdDialog;
        this._dispatchData = DispatchData;
        this._toastrService = toastrService;
        this._rateJobService = rateJobService;
        this._job = job;

        this.id = id;
        this.fieldName = fieldName;
        this.title = title;
        this.options = options;

        this.isLoading = false;
        this.searchText = "";
        this.selectedItem = existingItem;
        this.showRerateOption = showRerateOption;
        this.shouldRerateJob = false;
    }

    /**
     * Method to search query
     * @param {string} searchTerm
     */
    async querySearch(searchTerm) {
        try {
            const url = this.options.searchUrl;
            return await this._dispatchData.autocompleteSearch(searchTerm, url);
        } catch (error) {
            this._toastrService.showErrorToast(error.message);
        }
    }


    /**
     * Method to submit selected item
     * @param {SelectOption} selectedOption
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
                await this._dispatchData
                    .updateJobDetail(callData.jobID,
                        callData.field,
                        callData.value,
                        Number(rate.replace(/[^0-9.-]+/g, "")),
                        FirstName,
                        ContactID,
                        this._job.preBook);
            } else {
                this._job.bulkJob ?
                    await this._dispatchData.updateBulkJobDetail(this._job.id, callData.field, callData.value, this._job.charge, FirstName, ContactID) :
                    await this._dispatchData.updateJobDetail(callData.jobID, callData.field, callData.value, this._job.charge, FirstName, ContactID);
            }
        } catch (error) {
            this._toastrService.showErrorToast(error.message);
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

            this._toastrService.showSuccessToast(this.title + " successfully updated to " + selectedOption.text);
            this._$mdDialog.hide();
        }
    }

    cancel() {
        this._$mdDialog.cancel();
    }
}

angular.module('uDispatch').controller('AutoCompleteDialogController', AutoCompleteDialogController);
