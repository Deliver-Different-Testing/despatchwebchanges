enum ToastType {
    SUCCESS = 'success',
    ERROR = 'error',
    WARNING = 'warning',
    INFO = 'info'
}

class ToastrService implements angular.IServiceProvider {
    static $inject = [
        "$mdToast",
        "$document"
    ];

    constructor(
        private $mdToast: angular.material.IToastService,
        private $document: angular.IDocumentService
    ) {
    }

    $get() {
        return this;
    }

    showErrorToast(errorMessage: string = "An unexpected error occurred. Please try again or contact support") {
        console.error("Error:", errorMessage);
        return this.showToast(errorMessage, ToastType.ERROR);
    }

    showSuccessToast(successMessage: string) {
        console.log("Success:", successMessage);
        return this.showToast(successMessage, ToastType.SUCCESS);
    }

    showWarningToast(warningMessage: string) {
        console.warn("Warning:", warningMessage);
        return this.showToast(warningMessage, ToastType.WARNING);
    }

    private showToast(message: string, type: ToastType) {
        const preset = this.$mdToast.simple()
            .textContent(message)
            .position("bottom")
            .hideDelay(5000)
            .toastClass(`md-${type}-toast md-toast-custom md-center-toast`)
            .parent(this.$document.parent())
            .theme(`${type}-toast`);

        return this.$mdToast.show(preset);
    }
}

export default ToastrService;
