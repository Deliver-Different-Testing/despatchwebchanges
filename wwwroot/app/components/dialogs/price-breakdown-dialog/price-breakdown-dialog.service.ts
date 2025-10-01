import {PriceBreakdownDialogController} from "./price-breakdown-dialog.controller";
import DispatchCoreService from "../../../services/dispatch-core.service";
import {PriceBreakdown} from "../../../interfaces/job.interface";

class PriceBreakdownDialogService implements angular.IServiceProvider {
    static $inject = [
        '$mdDialog',
        'DispatchData',
        '$document'
    ];

    constructor(
        private $mdDialog: angular.material.IDialogService,
        private DispatchData: DispatchCoreService,
        private $document: angular.IDocumentService,
    ) {
        console.debug('PriceBreakdownDialogService: Service instantiated');
    }

    $get(): this {
        return this;
    }

    async openPriceBreakdownDialog($event: MouseEvent, jobId: number, isPrebook: boolean = false): Promise<number | undefined> {
        try {
            const priceBreakdown: PriceBreakdown[] = await this.DispatchData.getPriceBreakdown(jobId, isPrebook);

            const newAmount: number = await this.$mdDialog.show({
                controller: PriceBreakdownDialogController,
                controllerAs: 'ctrl',
                template: require("./price-breakdown-dialog.template.html"),
                parent: this.$document.parent(),
                targetEvent: $event,
                clickOutsideToClose: false,
                escapeToClose: true,
                locals: {
                    priceBreakdown,
                    jobId,
                    isPrebook
                },
                bindToController: true,
            });
            
            console.debug('PriceBreakdownDialogService: Dialog closed!');

            return newAmount;
        } catch (error) {
            if(!error) {
                console.debug('User closed dialog');
                return;
            }

            // Error occurred
            console.error('PriceBreakdownDialogService: Error in openPriceBreakdownDialog', error);
            throw error;
        }
    }
}

export default PriceBreakdownDialogService;
