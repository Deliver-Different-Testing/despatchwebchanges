class ToastrService {
    constructor($mdToast) {
        this.showErrorToast = function (errorMessage) {
            console.error(errorMessage);

            $mdToast.show(
                $mdToast.simple()
                    .textContent(errorMessage)
                    .position('top right')
                    .hideDelay(5000)
                    .toastClass('md-warn')
            );
        };

        this.showSuccessToast = function (message) {
            console.error(message);

            $mdToast.show(
                $mdToast.simple()
                    .textContent(message)
                    .position('top right')
                    .hideDelay(5000)
                    .toastClass('md-success')
            );
        };
    }
}

angular.module("uDispatch").service("toastrService", ToastrService);
