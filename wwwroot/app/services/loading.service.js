class LoadingService {
    constructor($mdDialog, $document) {
        this._$mdDialog = $mdDialog;
        this._$document = $document;
    }

    get _dialogTemplate() {
        return `
            <md-dialog style="background-color:transparent; box-shadow:none; overflow: hidden">
                <div layout="row" layout-sm="column" layout-align="center center">
                    <md-progress-circular class="md-hue-2" md-diameter="60"></md-progress-circular>
                </div>
            </md-dialog>`;
    }

    showLoader() {
        const template = this._dialogTemplate;
        this._$mdDialog.show({
            template,
            parent: angular.element(this._$document.body),
            clickOutsideToClose: false,
            fullscreen: false
        });
    }

    closeLoader() {
        this._$mdDialog.hide();
    }
}

angular.module("uDispatch").service("loadingService", [
    '$mdDialog',
    '$document',
    ($mdDialog, $document) => new LoadingService($mdDialog, $document)
]);
