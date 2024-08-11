/**
 * @typedef SelectOption
 *
 * @property {number} id - The unique identifier for the select object
 * @property {string} text - The display text for the select object
 */

class AutoCompleteDialogController {
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
            this._toastrService.showErrorToast();
        } finally {
            this.isLoading = false;
            this._$mdDialog.hide();
            this._toastrService.showSuccessToast(this.title + " successfully updated to " + selectedOption.text);
        }
    }

    cancel() {
        this._$mdDialog.cancel();
    }
}
