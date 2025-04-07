import {IDispatchJob, IJob} from "../../../interfaces/job.interface";
import DispatchCoreService from "../../../services/dispatch-core.service";
import AdditionalServicesDialogController from "./additional-services-dialog.controller";

class AdditionalServicesDialogService implements  angular.IServiceProvider {
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
        console.log('AdditionalServicesDialogService: Service instantiated');
    }

    $get() {
        return this;
    }

    async showAdditionalServicesDialog($event: MouseEvent, job: IJob | IDispatchJob) {
        try {
            console.log("Additional Services Dialog opened!");
            console.log("Job: ", job);

            if (!job.clientId || !job.speedId) {
                console.log("Speed is: ", job.speedId, "Client is: ", job.clientId, "")
                console.log("No client or speed selected!");
                return;
            }

            const isClientItemsAvailable = await this.DispatchData.hasClientItemsAvailable(job.clientId, job.speedId);

            if (!isClientItemsAvailable) {
                await this.$mdDialog.show(this.$mdDialog
                    .alert()
                    .clickOutsideToClose(true)
                    .title("No Additional Services")
                    .targetEvent($event)
                    .textContent("No additional services has been set up for this client. Please add a service through Admin Manager and try again.")
                    .ok("OK"));
                return;
            }

            await this.$mdDialog.show({
                controller: AdditionalServicesDialogController,
                controllerAs: "ctrl",
                template: require("./additional-services-dialog.template.html"),
                parent: this.$document.parent(),
                clickOutsideToClose: false,
                targetEvent: $event,
                fullscreen: true,
                locals: {
                    job,
                },
                bindToController: true,
            });

            console.log("Additional Services Dialog closed!");
        } catch (error: any) {
            if (error === undefined) {
                console.log("User canceled dialog!");
            } else {
                console.error("Error in showAdditionalServicesMenu:", error);
            }
        }
    }
}

export default AdditionalServicesDialogService;
