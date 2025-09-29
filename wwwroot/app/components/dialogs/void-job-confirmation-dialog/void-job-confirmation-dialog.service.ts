import {IDispatchJob, IJob} from "../../../interfaces/job.interface";
import VoidJobConfirmationDialogController from "./void-job-confirmation-dialog.controller";

class VoidJobConfirmationDialogService implements angular.IServiceProvider {
    static $inject = [
        '$mdDialog',
        '$document'
    ];

    constructor(
        private $mdDialog: angular.material.IDialogService,
        private $document: angular.IDocumentService
    ) {
        console.log('VoidJobConfirmationDialogService: Service instantiated');
    }

    $get() {
        return this;
    }

    async showVoidConfirmationDialog($event: MouseEvent, job: IDispatchJob | IJob) {
        await this.$mdDialog.show({
            template: require("./void-job-confirmation-dialog.template.html"),
            controller: VoidJobConfirmationDialogController,
            controllerAs: "ctrl",
            parent: this.$document.parent(),
            targetEvent: $event,
            clickOutsideToClose: true,
            locals: {
                job
            },
            bindToController: true
        });
    }
}

export default VoidJobConfirmationDialogService;