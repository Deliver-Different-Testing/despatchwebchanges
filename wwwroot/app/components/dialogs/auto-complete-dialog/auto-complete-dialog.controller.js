"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutoCompleteDialogController = void 0;
class AutoCompleteDialogController {
    constructor($mdDialog, dispatchData, toastrService, rateJobService, id, fieldName, title, job, options, existingItem, showRerateOption) {
        this.$mdDialog = $mdDialog;
        this.dispatchData = dispatchData;
        this.toastrService = toastrService;
        this.rateJobService = rateJobService;
        this.fieldName = fieldName;
        this.title = title;
        this.job = job;
        this.options = options;
        this.id = id;
        this.isLoading = false;
        this.searchText = "";
        this.shouldRerateJob = false;
        this.selectedItem = existingItem;
        this.showRerateOption = showRerateOption;
    }
    querySearch(searchTerm) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const url = this.options.searchUrl;
                return yield this.dispatchData.autocompleteSearch(searchTerm, url);
            }
            catch (error) {
                this.toastrService.showErrorToast(error.message);
            }
        });
    }
    submit(selectedOption) {
        return __awaiter(this, void 0, void 0, function* () {
            this.isLoading = true;
            try {
                const reRate = this.shouldRerateJob;
                const callData = {
                    call: "updateDetailField",
                    field: this.fieldName,
                    value: selectedOption.id,
                    jobID: this.job.id
                };
                if (reRate && !this.job.bulkJob) {
                    const rate = yield this.rateJobService.rateJob(this.job);
                    yield this.dispatchData.updateJobDetail(callData.jobID, callData.field, callData.value, Number(rate.replace(/[^0-9.-]+/g, "")), this.job.preBook);
                }
                else {
                    this.job.bulkJob
                        ? yield this.dispatchData.updateBulkJobDetail(this.job.id, callData.field, callData.value, this.job.charge, FirstName, ContactID)
                        : yield this.dispatchData.updateJobDetail(callData.jobID, callData.field, callData.value, this.job.charge, this.job.preBook);
                }
            }
            catch (error) {
                this.toastrService.showErrorToast(error.message);
            }
            finally {
                this.isLoading = false;
                // Update field
                const fieldName = this.fieldName.toLowerCase();
                const matchingField = Object.keys(this.job).find(key => key.toLowerCase() === fieldName);
                if (matchingField) {
                    this.job[matchingField] = selectedOption === null || selectedOption === void 0 ? void 0 : selectedOption.id;
                }
                else {
                    console.warn(`Field ${this.fieldName} not found in job object.`);
                }
                if (fieldName === "clientid") {
                    this.job.clientName = selectedOption.text;
                }
                this.toastrService.showSuccessToast(this.title + " successfully updated to " + selectedOption.text);
                this.$mdDialog.hide();
            }
        });
    }
    cancel() {
        this.$mdDialog.cancel();
    }
}
exports.AutoCompleteDialogController = AutoCompleteDialogController;
AutoCompleteDialogController.$inject = [
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
