/**
 * A service for displaying Material Design toast notifications
 * @class
 */
class ToastrService {
    constructor($mdToast, $document) {
        this.$mdToast = $mdToast;
        this.$document = $document

        // Material Design icons for different toast types
        this.icons = {
            error: 'error_outline',
            success: 'check_circle_outline',
            warning: 'warning_amber',
            info: 'info_outline'
        };
    }

    /**
     * Method to show error toast
     * @param {string} errorMessage
     */
    showErrorToast(errorMessage = "An unexpected error occurred. Please try again or contact support") {
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
     * Method to show info toast
     * @param {string} infoMessage
     */
    showInfoToast(infoMessage) {
        console.log('Info:', infoMessage);
        this._showToast(infoMessage, "info");
    }

    /**
     * Method to show toast
     * @param {string} message
     * @param {string} type - Toast type (error, success, warning, info)
     */
    _showToast(message, type) {
        return this.$mdToast.show(
            this.$mdToast.simple()
                .textContent(message)
                .position('top right')
                .hideDelay(5000)
                .toastClass(`md-${type}-toast md-toast-custom`)
                .parent(this.$document.body)
                .theme(`${type}-toast`)
                .highlightAction(true)
                .highlightClass('md-accent')
                .capsule(true)
        );
    }

    /**
     * Get the template for toast with icon
     * @param {string} message
     * @param {string} type
     * @returns {string}
     */
    _getToastTemplate(message, type) {
        return `
            <md-toast class="md-${type}-toast md-toast-custom">
                <span class="md-toast-content">
                    <i class="material-symbols-outlined">${this.icons[type]}</i>
                    <span flex>${message}</span>
                </span>
            </md-toast>
        `;
    }
}

// Register the service
angular.module("uDispatch").service("toastrService", [
    '$mdToast', '$document',
    ($mdToast, $document) => new ToastrService($mdToast, $document)
]);
