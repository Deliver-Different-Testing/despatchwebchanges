class LoadingService {
    constructor($mdDialog) {
        this.showLoadingDialog = function () {
            $mdDialog.show({
                template:
                    '<md-dialog id="plz_wait" style="width: 15%; height: 15%; overflow:hidden; background-color: rgba(0, 0, 0, 0.48); border-color: transparent;"' +
                    ' layout="row" layout-sm="column" layout-align="center center" aria-label="wait">' +
                    '<md-progress-circular md-mode="indeterminate" md-diameter="80"></md-progress-circular>' +
                    '</md-dialog>',
                parent: angular.element(document.body),
                hasBackdrop: true,
                clickOutsideToClose: false,
                fullscreen: false
            });
        }

        this.closeLoadingDialog = function () {
            $mdDialog.hide();
        }
    }
}

angular.module("uDispatch").service("loadingService", LoadingService);
