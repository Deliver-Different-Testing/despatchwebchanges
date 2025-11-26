import {IJob} from "../../../interfaces/job.interface";
import SimplePriceEditDialogController from "./simple-price-edit-dialog.controller";

class SimplePriceEditDialogService implements angular.IServiceProvider {
    static $inject = [
        '$mdDialog',
        '$document'
    ];

    constructor(
        private $mdDialog: angular.material.IDialogService,
        private $document: angular.IDocumentService,
    ) {
        console.log('SelectDialogService: Service instantiated');
    }

    $get(): any {
        return this;
    }

    async openSimplePriceEditDialog($event: MouseEvent, job: IJob): Promise<number> {
        return this.$mdDialog.show({
            controller: SimplePriceEditDialogController,
            controllerAs: "ctrl",
            parent: this.$document.parent(),
            targetEvent: $event,
            template: require("./simple-price-edit-dialog.template.html"),
            clickOutsideToClose: false,
            fullscreen: true,
            locals: {
                job
            },
            bindToController: true,
        });
    }
}

export default SimplePriceEditDialogService;