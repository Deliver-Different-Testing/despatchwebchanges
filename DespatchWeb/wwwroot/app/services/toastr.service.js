/**
 * A service for displaying different types of toast popups to the user
 * @class
 */
class ToastrService {
    constructor($mdToast) {
        this.$mdToast = $mdToast;
    }

    /**
     * Method to show error toast
     * @param {string} errorMessage
     */
    showErrorToast(errorMessage) {
        const defaultMessage = "An unexpected error occurred. Please try again";
        errorMessage = errorMessage || defaultMessage;

        console.log('Error:', errorMessage);
        this._showToast(errorMessage, "error");
    }

    /**
     * Method to show success toast
     * @param {string} successMessage
     */
    showSuccessToast(successMessage) {
        console.log('Success:', successMessage);
        this._showToast(successMessage, "success");
    }

    /**
     * Method to show warning toast
     * @param {string} warningMessage
     */
    showWarningToast(warningMessage) {
        console.log('Warning:', warningMessage);
        this._showToast(warningMessage, "warning");
    }

    /**
     * Method to show toast
     * @param {string} message
     * @param {string} theme - This theme is defined in the css and registred in app.js
     */
    _showToast(message, theme) {
        const toastInstance = this.$mdToast.simple()
            .textContent(message)
            .position('top right')
            .hideDelay(5000)
            .toastClass('md-' + theme + '-toast-theme');

        // Add theme using both methods to ensure it works
        toastInstance.theme(theme + '-toast');

        this.$mdToast.show(toastInstance);
    }
}

angular.module("uDispatch").service("toastrService", [
    '$mdToast',
    $mdToast => new ToastrService($mdToast)
]);
