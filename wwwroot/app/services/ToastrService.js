"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class ToastrService {
    constructor($mdToast, $document) {
        this.$mdToast = $mdToast;
        this.$document = $document;
    }
    showErrorToast(errorMessage = "An unexpected error occurred. Please try again or contact support") {
        console.error("Error:", errorMessage);
        this.showToast(errorMessage, "error");
    }
    showSuccessToast(successMessage) {
        console.log("Success:", successMessage);
        this.showToast(successMessage, "success");
    }
    showWarningToast(warningMessage) {
        console.warn("Warning:", warningMessage);
        this.showToast(warningMessage, "warning");
    }
    showToast(message, type) {
        const preset = this.$mdToast.simple()
            .textContent(message)
            .position("top right")
            .hideDelay(5000)
            .toastClass(`md-${type}-toast md-toast-custom`)
            .parent(this.$document.parent())
            .theme(`${type}-toast`)
            .highlightAction(true)
            .highlightClass("md-accent")
            .capsule(true);
        return this.$mdToast.show(preset);
    }
}
ToastrService.$inject = ["$mdToast", "$document"];
exports.default = ToastrService;
