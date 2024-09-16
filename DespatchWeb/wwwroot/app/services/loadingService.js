class LoadingService {
    constructor($mdDialog) {
        this.$mdDialog = $mdDialog;
    }

    get dialogTemplate() {
        return `
            <md-dialog style="background-color:transparent; box-shadow:none; overflow: hidden">
                <div layout="row" layout-sm="column" layout-align="center center">
                    <md-progress-circular class="md-hue-2" md-diameter="60"></md-progress-circular>
                </div>
            </md-dialog>`;
    }

    showLoader() {
        const template = this.dialogTemplate;
        this.$mdDialog.show({
            template,
            parent: angular.element(document.body),
            clickOutsideToClose: false,
            fullscreen: false
        });
    }

    closeLoader() {
        this.$mdDialog.hide();
    }
}

angular.module("uDispatch").service("loadingService", LoadingService);
