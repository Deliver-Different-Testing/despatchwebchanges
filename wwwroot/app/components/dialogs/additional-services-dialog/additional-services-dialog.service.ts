import {IDispatchJob, IJob} from "../../../interfaces/job.interface";
import DispatchCoreService from "../../../services/dispatch-core.service";
import AdditionalServicesDialogController from "./additional-services-dialog.controller";
import angular from 'angular';

class AdditionalServicesDialogService implements angular.IServiceProvider {
    static $inject = [
        '$log',
        '$mdDialog',
        'DispatchData',
        '$document'
    ];

    constructor(
        private $log: angular.ILogService,
        private $mdDialog: angular.material.IDialogService,
        private DispatchData: DispatchCoreService,
        private $document: angular.IDocumentService,
    ) {
        this.$log.debug('AdditionalServicesDialogService: Service instantiated');
    }

    $get() {
        return this;
    }

    async showAdditionalServicesDialog($event: MouseEvent, job: IJob | IDispatchJob) {
        try {
            this.$log.debug("Additional Services Dialog opened!");
            this.$log.debug("Job: ", job);

            if (!job.clientId || !job.speedId) {
                this.$log.debug("Speed is: ", job.speedId, "Client is: ", job.clientId, "")
                this.$log.debug("No client or speed selected!");
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

            this.$log.debug("Additional Services Dialog closed!");
        } catch (error: any) {
            if (error === undefined) {
                this.$log.debug("User canceled dialog!");
            } else {
                this.$log.error("Error in showAdditionalServicesMenu:", error);
            }
        }
    }
}

export default AdditionalServicesDialogService;
