enum ToastType {
    SUCCESS = 'success',
    ERROR = 'error',
    WARNING = 'warning',
    INFO = 'info',
}

class ToastrService implements angular.IServiceProvider {
    static $inject = [
        "$mdToast",
        "$log",
        "$document"
    ];

    constructor(
        private $mdToast: angular.material.IToastService,
        private $log: angular.ILogService,
        private $document: angular.IDocumentService
    ) {
        this.$log.log("Toastr service initialized");
    }

    $get() {
        return this;
    }

    showInfoToast(infoMessage: string) {
       this.$log.info("Info:", infoMessage);
        return this.showToast(infoMessage, ToastType.INFO);
    }

    showErrorToast(errorMessage: string = "An unexpected error occurred. Please try again or contact support") {
        this.$log.error("Error:", errorMessage);
        return this.showToast(errorMessage, ToastType.ERROR);
    }

    showSuccessToast(successMessage: string) {
        this.$log.debug("Success:", successMessage);
        return this.showToast(successMessage, ToastType.SUCCESS);
    }

    showWarningToast(warningMessage: string) {
        this.$log.warn("Warning:", warningMessage);
        return this.showToast(warningMessage, ToastType.WARNING);
    }

    private showToast(message: string, type: ToastType) {
        const preset = this.$mdToast.simple()
            .textContent(message)
            .position("top right")
            .toastClass(`md-${type}-toast md-toast-custom`)
            .hideDelay(3000)
            .parent(this.$document.parent())
            .theme(`${type}-toast`);

        return this.$mdToast.show(preset);
    }
}

export default ToastrService;
