import app from "../app";
import angular from "angular";

class ToastrService {
    static $inject = ["$mdToast", "$document"];

    constructor(private $mdToast: angular.material.IToastService,
                private $document: angular.IDocumentService) {
    }

    showErrorToast(errorMessage: string = "An unexpected error occurred. Please try again or contact support"): void {
        console.error("Error:", errorMessage);
        this.showToast(errorMessage, "error");
    }

    showSuccessToast(successMessage: string): void {
        console.log("Success:", successMessage);
        this.showToast(successMessage, "success");
    }

    showWarningToast(warningMessage: string): void {
        console.warn("Warning:", warningMessage);
        this.showToast(warningMessage, "warning");
    }

    private showToast(message: string, type: 'success' | 'error' | 'warning' | 'info'): angular.IPromise<any> {
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

app.service("toastrService", ToastrService);
export default ToastrService;
