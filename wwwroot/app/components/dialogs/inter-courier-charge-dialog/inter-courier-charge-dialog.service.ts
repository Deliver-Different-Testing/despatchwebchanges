import {IDocumentService, IServiceProvider, material} from "angular";
import {bindAllMethods} from "../../../bindAllMethods";
import InterCourierChargeDialogController from "./inter-courier-charge-dialog.controller";
import ToastrService from "../../../services/toastr.service";

class InterCourierChargeDialogService implements IServiceProvider {
    static $inject = [
        '$mdDialog',
        "$document",
        "toastrService"
    ];

    constructor(
        private $mdDialog: material.IDialogService,
        private $document: IDocumentService,
        private toastrService: ToastrService,
    ) {
        console.log('InterCourierChargeDialogService: Service instantiated');
        bindAllMethods(this);
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
                fullscreen: true
            });

            console.log("Inter-courier Charge Added!");
            this.toastrService.showSuccessToast("Inter-courier charge added successfully");
        } catch (error: any) {
            if (error === undefined) {
                console.log("Inter-courier Charge Canceled!");
            } else {
                throw error;
            }
        }
    }
}

export default InterCourierChargeDialogService;
