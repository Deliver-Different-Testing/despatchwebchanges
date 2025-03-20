import {PriceBreakdownDialogController} from "./price-breakdown-dialog.controller";
import DispatchCoreService from "../../../services/dispatch-core.service";
import {PriceBreakdown} from "../../../interfaces/job.interface";

class PriceBreakdownDialogService implements angular.IServiceProvider {
    static $inject = [
        '$mdDialog',
        'DispatchData'
    ];

    constructor(
        private $mdDialog: angular.material.IDialogService,
        private DispatchData: DispatchCoreService,
    ) {
        console.log('PriceBreakdownDialogService: Service instantiated');
    }

    $get(): any {
        return this;
    }

    async openPriceBreakdownDialog($event: MouseEvent, jobId: number, isPrebook: boolean = false) {
        try {
            const priceBreakdown: PriceBreakdown[] = await this.DispatchData.getPriceBreakdown(jobId);

            await this.$mdDialog.show({
                controller: PriceBreakdownDialogController,
                controllerAs: 'ctrl',
                template: require("./price-breakdown-dialog.template.html"),
                parent: document.body,
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

            console.log('PriceBreakdownDialogService: Dialog closed!');
        } catch (error) {
            if(error === undefined) {
                return;
            }

            // Error occurred
            console.error('PriceBreakdownDialogService: Error in openPriceBreakdownDialog', error);
            throw error;
        }
    }
}

export default PriceBreakdownDialogService;
