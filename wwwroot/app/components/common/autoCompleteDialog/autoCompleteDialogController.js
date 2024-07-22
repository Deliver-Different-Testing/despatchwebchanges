// Controller to handle the autocomplete popups
class AutoCompleteDialogController {
    constructor($scope, $mdDialog, DispatchData, toastrService, loadingService, rateJobService, id, fieldName, title, job, options, existingItem, showRerateOption) {
        this.$scope = $scope;
        this.$mdDialog = $mdDialog;
        this.DispatchData = DispatchData;
        this.toastrService = toastrService;
        this.loadingService = loadingService;
        this.rateJobService = rateJobService;

        this.id = id;
        this.fieldName = fieldName;
        this.title = title;
        this.job = job;
        this.options = options;

        this.searchText = "";
        this.selectedItem = existingItem;
        this.showRerateOption = showRerateOption;
        this.shouldRerateJob = false;
    }

    async querySearch(searchTerm) {
        try {
            const url = this.options.searchUrl;
            return await this.DispatchData.autocompleteSearch(searchTerm, url);
        } catch (error) {
            this.toastrService.showErrorToast(error.message);
        }
    }

    async submit(selectedItem) {
        this.loadingService.showLoader();

        try {
            const reRate = this.shouldRerateJob;
            const callData = {
                "call": "updateDetailField",
                "field": this.fieldName,
                "value": selectedItem.id,
                "jobID": this.job.id
            };

            if (reRate && !this.job.bulkJob) {
                const rate = await this.rateJobService.rateJob(this.job);
                await this.DispatchData
                    .updateJobDetail(callData.jobID,
                        callData.field,
                        callData.value,
                        Number(rate.replace(/[^0-9.-]+/g, "")),
                        FirstName,
                        ContactID,
                        this.job.preBook);
            } else {
                this.job.bulkJob ?
                    await this.DispatchData.updateBulkJobDetail(this.job.id, callData.field, callData.value, this.job.charge, FirstName, ContactID) :
                    await this.DispatchData.updateJobDetail(callData.jobID, callData.field, callData.value, this.job.charge, FirstName, ContactID);
            }
        } catch (error) {
            this.toastrService.showErrorToast();
        } finally {
            this.$mdDialog.hide();
            this.loadingService.closeLoader();
            this.toastrService.showSuccessToast(this.title + " successfully updated to " + selectedItem.text);
        }
    }

    cancel() {
        this.$mdDialog.cancel();
    }
}
