import angular from 'angular';
enum ToastType {
    SUCCESS = 'success',
    ERROR = 'error',
    WARNING = 'warning',
    INFO = 'info',
}

class ToastrService implements angular.IServiceProvider {
    static $inject = [
        "$mdToast",
    ];

    constructor(
        private $mdToast: angular.material.IToastService,
    ) {}

    $get() {
        return this;
    }

    showInfoToast(infoMessage: string): angular.IPromise<any> {
        console.info("Info:", infoMessage);
        return this.showToast(infoMessage, ToastType.INFO);
    }

    showErrorToast(errorMessage: string = "An unexpected error occurred. Please try again or contact support"): angular.IPromise<any> {
        console.error("Error:", errorMessage);
        return this.showToast(errorMessage, ToastType.ERROR);
    }

    showSuccessToast(successMessage: string): angular.IPromise<any> {
        console.debug("Success:", successMessage);
        return this.showToast(successMessage, ToastType.SUCCESS);
    }

    showWarningToast(warningMessage: string): angular.IPromise<any> {
        console.warn("Warning:", warningMessage);
        return this.showToast(warningMessage, ToastType.WARNING);
    }

    private showToast(message: string, type: ToastType): angular.IPromise<any> {
        const preset = this.$mdToast.simple()
            .textContent(message)
            .position("bottom center")
            .hideDelay(3000)
            .parent(angular.element(document.body))
            .theme(`${type}-toast`);

        return this.$mdToast.show(preset);
    }
}

export default ToastrService;