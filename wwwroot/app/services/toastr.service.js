import app from "../app";

class toastrService {
    static $inject = ["$mdToast", "$document"];

    constructor($mdToast, $document) {
        this.$mdToast = $mdToast;
        this.$document = $document;
    }

    /**
     * Show an error toast message
     * @param {string} [errorMessage="An unexpected error occurred. Please try again or contact support"] - The error message to display
     */
    showErrorToast(errorMessage = "An unexpected error occurred. Please try again or contact support") {
        console.error("Error:", errorMessage);
        this.showToast(errorMessage, "error");
    }

    /**
     * Show a success toast message
     * @param {string} successMessage - The success message to display
     */
    showSuccessToast(successMessage) {
        console.log("Success:", successMessage);
        this.showToast(successMessage, "success");
    }

    /**
     * Show a warning toast message
     * @param {string} warningMessage - The warning message to display
     */
    showWarningToast(warningMessage) {
        console.warn("Warning:", warningMessage);
        this.showToast(warningMessage, "warning");
    }

    /**
     * Show a toast message with the specified type
     * @private
     * @param {string} message - The message to display
     * @param {'success'|'error'|'warning'|'info'} type - The type of toast
     * @returns {angular.IPromise<any>} Promise that resolves when the toast is shown
     */
    showToast(message, type) {
        const preset = this.$mdToast.simple()
            .textContent(message)
            .position("top right")
            .hideDelay(5000)
            .toastClass(`md-${type}-toast md-toast-custom`)
            .parent(this.$document[0].body)
            .theme(`${type}-toast`)
            .highlightAction(true)
            .highlightClass("md-accent")
            .capsule(true);

        return this.$mdToast.show(preset);
    }
}

app.service("toastrService", toastrService);
