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
exports.AddNotesDialogController = void 0;
class AddNotesDialogController {
    constructor($mdDialog, toastrService, DispatchData, fieldName, job) {
        this.$mdDialog = $mdDialog;
        this.toastrService = toastrService;
        this.DispatchData = DispatchData;
        this.fieldName = fieldName;
        this.job = job;
        this.isLoading = false;
    }
    $onInit() {
        if (this.fieldName === "Note") {
            this.note = this.job.internalNotes;
        }
        else if (this.fieldName === "ConNote") {
            this.note = this.job.conNote;
        }
        else {
            this.note = "";
        }
    }
    submit(note) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                this.isLoading = true;
                if (this.fieldName === "Note") {
                    yield this.addJobNote(this.job.id, note, FirstName, this.job.preBook, this.job.bulkJob);
                    this.job.internalNotes = note;
                }
                else if (this.fieldName === "ConNote") {
                    yield this.DispatchData.addConNote(this.job.id, note);
                    this.job.conNote = note;
                }
                else {
                    // Other type of notes
                    const callData = {
                        "call": "updateDetailField",
                        "field": this.fieldName,
                        "value": note,
                        "jobID": this.job.id
                    };
                    yield this.updateJobDetail(this.job.bulkJob, callData.jobID, callData.field, callData.value, this.job.charge, FirstName, ContactID, this.job.preBook);
                    if (this.isValidJobField(this.fieldName)) {
                        this.job[this.fieldName] = note;
                    }
                }
                this.toastrService.showSuccessToast("Note saved");
                this.$mdDialog.hide(this.job);
            }
            catch (error) {
                this.toastrService.showErrorToast(error.message);
            }
            finally {
                this.isLoading = false;
            }
        });
    }
    addJobNote(id, note, firstName, preBook, bulkJob) {
        return __awaiter(this, void 0, void 0, function* () {
            if (bulkJob) {
                yield this.DispatchData.addBulkJobNote(id, note, firstName, preBook);
            }
            else {
                yield this.DispatchData.addNote(id, note, firstName, preBook);
            }
        });
    }
    updateJobDetail(bulkJob, jobID, field, value, charge, firstName, contactID, preBook) {
        return __awaiter(this, void 0, void 0, function* () {
            if (bulkJob) {
                yield this.DispatchData.updateBulkJobDetail(jobID, field, value, charge, firstName, contactID);
            }
            else {
                yield this.DispatchData.updateJobDetail(jobID, field, value, charge, preBook);
            }
        });
    }
    cancel() {
        this.$mdDialog.cancel();
    }
    isValidJobField(fieldName) {
        return fieldName in this.job;
    }
}
exports.AddNotesDialogController = AddNotesDialogController;
AddNotesDialogController.$inject = ["$mdDialog", "toastrService", "DispatchData", "fieldName", "job"];
