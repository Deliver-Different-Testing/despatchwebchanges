class ToastrService {
    constructor($mdToast) {
        this.showToast = function (errorMessage) {
            console.error(errorMessage);

            $mdToast.show(
                $mdToast.simple()
                    .textContent(errorMessage)
                    .position('top right')
                    .hideDelay(5000)
                    .toastClass('md-warn')
            );
        };
    }
}

angular.module("uDispatch").service("toastrService", ToastrService);
