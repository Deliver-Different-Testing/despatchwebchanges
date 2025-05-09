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
exports.EditParcelDimensionsDialogController = void 0;
require("./edit-parcel-dimensions-dialog.styles.less");
class EditParcelDimensionsDialogController {
    constructor($mdDialog, toastrService, DispatchData, jobId, parcels) {
        this.$mdDialog = $mdDialog;
        this.toastrService = toastrService;
        this.DispatchData = DispatchData;
        this.jobId = jobId;
        this.parcels = parcels;
        // Initialize with empty array if no parcels provided
        this.selectedParcelIndex = 0;
        console.log("Initializing EditParcelDimensionsDialog with jobId:", jobId);
        console.log("Initial parcels:", this.parcels);
        this.isLoading = false;
    }
    initializeParcel() {
        return {
            itemName: "",
            length: undefined,
            depth: undefined,
            height: undefined,
            dimensions: "",
        };
    }
    addNewParcel() {
        const newParcel = this.initializeParcel();
        this.parcels.push(newParcel);
        this.selectedParcelIndex = this.parcels.length - 1;
    }
    deleteParcel(index, $event) {
        if ($event) {
            $event.stopPropagation();
        }
        // Remove the parcel
        this.parcels.splice(index, 1);
        if (this.parcels.length === 0) {
            this.selectedParcelIndex = 0;
        }
        else if (index <= this.selectedParcelIndex) {
            this.selectedParcelIndex = Math.max(0, this.selectedParcelIndex - 1);
        }
    }
    getCurrentParcel() {
        return this.parcels[this.selectedParcelIndex] || null;
    }
    hasCurrentParcel() {
        return this.parcels.length > 0;
    }
    switchParcel(index) {
        console.log(`Switching to parcel ${index}`);
        if (index >= 0 && index < this.parcels.length) {
            this.selectedParcelIndex = index;
        }
    }
    isValid() {
        const currentParcel = this.getCurrentParcel();
        if (!currentParcel)
            return false;
        const isValid = typeof currentParcel.length === "number" &&
            currentParcel.length > 0 &&
            typeof currentParcel.depth === "number" &&
            currentParcel.depth > 0 &&
            typeof currentParcel.height === "number" &&
            currentParcel.height > 0;
        console.log("Form validation result:", isValid, {
            length: currentParcel === null || currentParcel === void 0 ? void 0 : currentParcel.length,
            depth: currentParcel === null || currentParcel === void 0 ? void 0 : currentParcel.depth,
            height: currentParcel === null || currentParcel === void 0 ? void 0 : currentParcel.height,
        });
        return isValid;
    }
    cancel() {
        console.log("Dialog cancelled");
        this.$mdDialog.cancel();
    }
    submit() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log("Submit called with parcels:", this.parcels);
            try {
                yield this.DispatchData.updatePackages(this.jobId, this.parcels);
                // Success message and close
                const count = this.parcels.length;
                this.toastrService.showSuccessToast(`Successfully ${count} ${count === 1 ? "parcel" : "parcels"} updated`);
                this.$mdDialog.hide();
            }
            catch (error) {
                console.error("An error occured while updating packages:", error);
                this.toastrService.showErrorToast(error.message);
            }
        });
    }
}
exports.EditParcelDimensionsDialogController = EditParcelDimensionsDialogController;
EditParcelDimensionsDialogController.$inject = ["$mdDialog", "toastrService", "DispatchData", "jobId", "parcels"];
