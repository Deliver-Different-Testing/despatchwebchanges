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
exports.SendMessageDialogController = void 0;
class SendMessageDialogController {
    constructor($mdDialog, dispatchData, toastrService, selectedCourierId, contactId, dispatcherName) {
        this.$mdDialog = $mdDialog;
        this.dispatchData = dispatchData;
        this.toastrService = toastrService;
        this.selectedCourierId = selectedCourierId;
        this.contactId = contactId;
        this.dispatcherName = dispatcherName;
        this.isLoading = false;
        this.message = "";
    }
    submit(message) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                this.isLoading = true;
                yield this.dispatchData.sendSMS(this.selectedCourierId, this.contactId, this.dispatcherName, message);
                this.toastrService.showSuccessToast("Message sent!");
            }
            catch (error) {
                this.toastrService.showErrorToast(error.message);
            }
            finally {
                this.isLoading = false;
                this.$mdDialog.hide();
            }
        });
    }
    cancel() {
        this.$mdDialog.cancel();
    }
}
exports.SendMessageDialogController = SendMessageDialogController;
SendMessageDialogController.$inject = [
    "$mdDialog",
    "DispatchData",
    "toastrService",
    "selectedCourierId",
    "contactId",
    "dispatcherName"
];
