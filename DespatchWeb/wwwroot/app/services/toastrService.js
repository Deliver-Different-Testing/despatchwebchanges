class ToastrService {
    constructor($mdToast) {
        this.$mdToast = $mdToast;
    }

    showErrorToast(errorMessage) {
        if (!errorMessage) {
            errorMessage = "An unexpected error occurred. Please try again";
        }
        console.error(errorMessage);
        this.showToast(errorMessage);
    }

    showSuccessToast(message) {
        console.log(message);
        this.showToast(message);
    }

    showToast(message) {
        this.$mdToast.show(
            this.$mdToast.simple()
                .textContent(message)
                .position('top right')
                .hideDelay(5000)
        );
    }
}

angular.module("uDispatch").service("toastrService", ToastrService);
