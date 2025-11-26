import {PriceBreakdownDialogController} from "./price-breakdown-dialog.controller";
import DispatchCoreService from "../../../services/dispatch-core.service";
import {IJob, PriceBreakdown} from "../../../interfaces/job.interface";
import ToastrService from "../../../services/toastr.service";
import SimplePriceEditDialogService from "../simple-price-edit-dialog/simple-price-edit-dialog.service";

class PriceBreakdownDialogService implements angular.IServiceProvider {
    static $inject = [
        '$mdDialog',
        'DispatchData',
        '$document',
        'toastrService',
        "simplePriceEditDialogService",
    ];

    constructor(
        private $mdDialog: angular.material.IDialogService,
        private DispatchData: DispatchCoreService,
        private $document: angular.IDocumentService,
        private toastrService: ToastrService,
        private simplePriceEditDialogService: SimplePriceEditDialogService
    ) {
        console.debug('PriceBreakdownDialogService: Service instantiated');
    }

    $get(): this {
        return this;
    }

    private isUsingOldAmountMethod(jobAmount?: number, priceBreakdowns?: PriceBreakdown[]): boolean {
        const isUsingOldMethod = !!jobAmount && jobAmount > 0 && (!priceBreakdowns || priceBreakdowns.length === 0);
        console.log('Job isUsingOldAmountMethod', isUsingOldMethod);
        return isUsingOldMethod;
    }

    async openPriceBreakdownDialog($event: MouseEvent,
                                   job: IJob): Promise<number | undefined> {
        try {
            const priceBreakdowns: PriceBreakdown[] = await this.DispatchData.getPriceBreakdown(job.id, job.preBook);

            // Check if using the old amount method and just show text
            if(this.isUsingOldAmountMethod(job.charge, priceBreakdowns)) {
                try {
                    const newAmount = await this.simplePriceEditDialogService.openSimplePriceEditDialog($event, job);
                    await this.DispatchData.simpleRepriceJobManual(job.id, job.preBook, newAmount);
                    return newAmount;
                } catch (error) {
                    if(!error) return;

                    this.toastrService.showErrorToast('Job amount update failed.');
                    console.error('PriceBreakdownDialogService: Error in openPriceBreakdownDialog', error);
                    return;
                }
            }

            const newAmount: number = await this.$mdDialog.show({
                controller: PriceBreakdownDialogController,
                controllerAs: 'ctrl',
                template: require("./price-breakdown-dialog.template.html"),
                parent: this.$document.parent(),
                targetEvent: $event,
                clickOutsideToClose: false,
                escapeToClose: true,
                locals: {
                    priceBreakdowns,
                    jobId: job.id,
                    isPrebook: job.preBook,
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
