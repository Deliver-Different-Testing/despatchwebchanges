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
exports.PalletDialogController = void 0;
class PalletDialogController {
    constructor($scope, $mdDialog, dispatchData, toastrService, rateJobService, job, dispatcherName, contactId, existingPallet) {
        this.$mdDialog = $mdDialog;
        this.dispatchData = dispatchData;
        this.toastrService = toastrService;
        this.rateJobService = rateJobService;
        this.job = job;
        this.dispatcherName = dispatcherName;
        this.contactId = contactId;
        this.isLoading = false;
        this.palletForm = $scope.palletForm;
        this.isEditing = !!existingPallet;
        this.pallet = existingPallet || {
            id: job.id,
            quantity: 0,
            weight: 0.0,
            length: 0.0,
            depth: 0.0,
            height: 0.0,
            pu: false,
            do: false,
            dgClass: "",
            notes: ""
        };
        this.formFields = [
            { name: "quantity", label: "# of pallets", colSize: "6", value: this.pallet.quantity },
            { name: "weight", label: "Weight (KG)", colSize: "6", value: this.pallet.weight },
            { name: "length", label: "Length (m)", colSize: "6", value: this.pallet.length },
            { name: "depth", label: "Depth (m)", colSize: "6", value: this.pallet.depth },
            { name: "height", label: "Height (m)", colSize: "6", value: this.pallet.height },
            { name: "pu", label: "PU", colSize: "6", type: "checkbox", value: this.pallet.pu },
            { name: "do", label: "DO", colSize: "6", type: "checkbox", value: this.pallet.do },
            { name: "dgClass", label: "DG Class", colSize: "6", value: this.pallet.dgClass },
            { name: "notes", label: "Notes", colSize: "12", type: "textarea", value: this.pallet.notes }
        ];
    }
    submit() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!this.palletForm.$valid) {
                    this.toastrService.showWarningToast("Please complete all the required fields.");
                    return;
                }
                this.isLoading = true;
                const palletData = this.formFields.reduce((acc, field) => {
                    acc[field.name] = field.value;
                    return acc;
                }, {});
                let response;
                if (this.isEditing) {
                    palletData.id = this.pallet.id;
                    palletData.itemId = this.pallet.itemID;
                    response = yield this.dispatchData.editPallet(palletData, this.job.preBook, this.dispatcherName);
                }
                else {
                    response = yield this.dispatchData.addPallet(palletData, this.job.preBook, this.dispatcherName);
                }
                if (response === "OK") {
                    if (!this.job.palletInfo) {
                        this.job.palletInfo = [];
                    }
                    if (this.isEditing) {
                        const index = this.job.palletInfo.findIndex((p) => p.id === this.pallet.id);
                        if (index !== -1) {
                            this.job.palletInfo[index] = palletData;
                        }
                    }
                    else {
                        this.job.palletInfo.push(palletData);
                    }
                    const rate = yield this.rateJobService.rateJob(this.job);
                    if (rate !== this.job.charge) {
                        yield this.dispatchData.updateJobDetail(this.job.id, "rate", Number(rate.replace(/[^0-9.-]+/g, "")), Number(rate.replace(/[^0-9.-]+/g, "")), this.job.preBook);
                    }
                    this.toastrService.showSuccessToast(`Pallet ${this.isEditing ? "updated" : "added"} successfully`);
                }
            }
            catch (error) {
                this.toastrService.showErrorToast(error.message);
            }
            finally {
                this.isLoading = false;
            }
            this.$mdDialog.hide();
        });
    }
    cancel() {
        this.$mdDialog.cancel();
    }
}
exports.PalletDialogController = PalletDialogController;
PalletDialogController.$inject = ["$scope", "$mdDialog", "DispatchData", "toastrService", "rateJobService", "job", "dispatcherName", "contactId", "existingPallet"];
