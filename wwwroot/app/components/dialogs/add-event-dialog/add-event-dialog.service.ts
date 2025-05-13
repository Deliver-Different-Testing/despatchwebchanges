import {IDispatchJob, IJob} from "../../../interfaces/job.interface";
import AddEventDialogController from "./add-event-dialog.controller";
import {bindAllMethods} from "../../../functions/bindAllMethods";

class AddEventDialogService implements angular.IServiceProvider {
    static $inject = [
        '$mdDialog',
        "$document"
    ];

    constructor(
        private $mdDialog: angular.material.IDialogService,
        private $document: angular.IDocumentService,
    ) {
        console.log('EditAddressDialogService: Service instantiated');
        bindAllMethods(this);
    }

    $get() {
        return this;
    }

    async openAddEventDialog($event: MouseEvent, job: IJob | IDispatchJob) {
        await this.$mdDialog
            .show({
                controller: AddEventDialogController,
                controllerAs: "ctrl",
                template: require("./add-event-dialog.template.html"),
                parent: this.$document.parent(),
                clickOutsideToClose: true,
                fullscreen: true,
                targetEvent: $event,
                locals: {
                    job: job, dispatcherName: FirstName, contactId: ContactID,
                },
                bindToController: true,
            });
    }
}

export default AddEventDialogService;
