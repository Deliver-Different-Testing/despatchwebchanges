import {PriceBreakdownDialogController} from "./price-breakdown-dialog.controller";
import DispatchCoreService from "../../../services/dispatch-core.service";
import {PriceBreakdown} from "../../../interfaces/job.interface";

class PriceBreakdownDialogService implements angular.IServiceProvider {
    static $inject = [
        '$mdDialog',
        '$log',
        'DispatchData',
        '$document'
    ];

    constructor(
        private $mdDialog: angular.material.IDialogService,
        private $log: angular.ILogService,
        private DispatchData: DispatchCoreService,
        private $document: angular.IDocumentService,
    ) {
        this.$log.debug('PriceBreakdownDialogService: Service instantiated');
    }

    $get() {
        return this;
    }

    async openPriceBreakdownDialog($event: MouseEvent, jobId: number, isPrebook: boolean = false) {
        try {
            const priceBreakdown: PriceBreakdown[] = await this.DispatchData.getPriceBreakdown(jobId, isPrebook);

            await this.$mdDialog.show({
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

            this.$log.debug('PriceBreakdownDialogService: Dialog closed!');
        } catch (error) {
            if(error === undefined) {
                this.$log.debug('User closed dialog');
                return;
            }

            // Error occurred
            this.$log.error('PriceBreakdownDialogService: Error in openPriceBreakdownDialog', error);
            throw error;
        }
    }
}

export default PriceBreakdownDialogService;
