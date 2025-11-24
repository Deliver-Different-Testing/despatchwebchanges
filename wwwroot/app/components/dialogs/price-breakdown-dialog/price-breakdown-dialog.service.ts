import {PriceBreakdownDialogController} from "./price-breakdown-dialog.controller";
import DispatchCoreService from "../../../services/dispatch-core.service";
import {PriceBreakdown} from "../../../interfaces/job.interface";
import ToastrService from "../../../services/toastr.service";

class PriceBreakdownDialogService implements angular.IServiceProvider {
    static $inject = [
        '$mdDialog',
        'DispatchData',
        '$document',
        'toastrService',
    ];

    constructor(
        private $mdDialog: angular.material.IDialogService,
        private DispatchData: DispatchCoreService,
        private $document: angular.IDocumentService,
        private toastrService: ToastrService,
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
                                   jobId: number,
                                   jobAmount: number,
                                   isPrebook: boolean = false): Promise<number | undefined> {
        try {
            const priceBreakdowns: PriceBreakdown[] = await this.DispatchData.getPriceBreakdown(jobId, isPrebook);

            // Check if using the old amount method and just show text
            if(this.isUsingOldAmountMethod(jobAmount, priceBreakdowns)) {
                const prompt = this.$mdDialog
                    .prompt()
                    .title("Edit Job Amount")
                    .textContent('This will manually reprice the job. Enter the new total amount.')
                    .initialValue(jobAmount.toString())
                    .targetEvent($event)
                    .required(true)
                    .ok("Reprice")
                    .cancel("Cancel");

                try {
                    let isValid = false;
                    let numericValue: number = -1;

                    // Loop until we get a valid number or user cancels
                    while (!isValid) {
                        const result: string = await this.$mdDialog.show(prompt);
                        numericValue = parseFloat(result);

                        if (isNaN(numericValue) || numericValue < 0) {
                            // Show error and continue loop
                            this.toastrService.showErrorToast('Please enter a valid number.');
                            console.error('Invalid input. Please enter a valid number.');
                        } else {
                            isValid = true;
                        }
                    }

                    if(!numericValue || numericValue == jobAmount) return;
                    await this.DispatchData.simpleRepriceJobManual(jobId, isPrebook, numericValue);
                    this.toastrService.showSuccessToast('Job amount updated successfully.');
                    return numericValue;
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
                    jobId,
                    isPrebook,
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
