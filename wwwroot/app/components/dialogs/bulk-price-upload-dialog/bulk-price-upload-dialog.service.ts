import BulkPriceUploadDialogController from "./bulk-price-upload-dialog.controller";

class BulkPriceUploadDialogService implements angular.IServiceProvider {
    static $inject = [
        '$mdDialog',
        '$document'
    ];

    constructor(
        private $mdDialog: angular.material.IDialogService,
        private $document: angular.IDocumentService,
    ) {}

    $get(): any {
        return this;
    }

    async openBulkPriceUploadDialog($event: MouseEvent): Promise<boolean> {
        return this.$mdDialog.show({
            controller: BulkPriceUploadDialogController,
            controllerAs: "ctrl",
            parent: this.$document.parent(),
            targetEvent: $event,
            template: require("./bulk-price-upload-dialog.template.html"),
            clickOutsideToClose: false,
            fullscreen: true,
            bindToController: true,
        });
    }
}

export default BulkPriceUploadDialogService;
