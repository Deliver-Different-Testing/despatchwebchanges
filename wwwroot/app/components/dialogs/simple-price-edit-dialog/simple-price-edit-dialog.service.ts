import {IJob} from "../../../interfaces/job.interface";
import SimplePriceEditDialogController from "./simple-price-edit-dialog.controller";

export type PricingMode = 'recalculate' | 'base' | 'gross';

export interface PriceEditResult {
    mode: PricingMode;
    amount: number;
}

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

    async openSimplePriceEditDialog($event: MouseEvent, job: IJob, isPrebook: boolean = false): Promise<PriceEditResult> {
        return this.$mdDialog.show({
            controller: SimplePriceEditDialogController,
            controllerAs: "ctrl",
            parent: this.$document.parent(),
            targetEvent: $event,
            template: require("./simple-price-edit-dialog.template.html"),
            clickOutsideToClose: false,
            fullscreen: true,
            locals: {
                job,
                isPrebook
            },
            bindToController: true,
        });
    }
}

export default SimplePriceEditDialogService;