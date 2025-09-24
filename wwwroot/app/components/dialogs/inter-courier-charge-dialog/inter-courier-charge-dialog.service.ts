import {IDocumentService, IServiceProvider, material} from "angular";
import InterCourierChargeDialogController from "./inter-courier-charge-dialog.controller";
import ToastrService from "../../../services/toastr.service";

class InterCourierChargeDialogService implements IServiceProvider {
    static $inject = [
        '$mdDialog',
        '$log',
        "$document",
        "toastrService"
    ];

    constructor(
        private $mdDialog: material.IDialogService,
        private $log: angular.ILogService,
        private $document: IDocumentService,
        private toastrService: ToastrService,
    ) {
        this.$log.debug('InterCourierChargeDialogService: Service instantiated');
    }

    $get() {
        return this;
    }

    async showInterCourierCharge($event: MouseEvent) {
        try {
            await this.$mdDialog.show({
                controller: InterCourierChargeDialogController,
                controllerAs: "ctrl",
                parent: this.$document.parent(),
                targetEvent: $event,
                template: require("./inter-courier-charge-dialog.template.html"),
                clickOutsideToClose: false,
                fullscreen: true,
                bindToController: true,
            });

            this.$log.debug("Inter-courier Charge Added!");
            this.toastrService.showSuccessToast("Inter-courier charge added successfully");
        } catch (error: any) {
            if (error === undefined) {
                this.$log.debug("Inter-courier Charge Canceled!");
            } else {
                throw error;
            }
        }
    }
}

export default InterCourierChargeDialogService;
