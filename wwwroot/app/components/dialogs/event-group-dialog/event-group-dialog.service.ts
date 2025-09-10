import DispatchCoreService from "../../../services/dispatch-core.service";
import {EventGroupDialogController} from "./event-group-dialog.controller";

export class EventGroupDialogService implements angular.IServiceProvider {
    static $inject = [
        "$mdDialog",
        "$log",
        "DispatchData",
        "$document"
    ];

    constructor(
        private $mdDialog: angular.material.IDialogService,
        private $log: angular.ILogService,
        private DispatchData: DispatchCoreService,
        private $document: angular.IDocumentService,
    ) {
        console.log('EventGroupDialogService: Service instantiated');
    }

    $get() {
        return this;
    }

    async openEventGroupDialog(eventGroupId: number, jobId: number) {
        try {
            const eventTypeGroups = await this.DispatchData.getEventTypeGroups(eventGroupId);
            const users = await this.DispatchData.getActiveStaff();

            await this.$mdDialog.show({
                controller: EventGroupDialogController,
                controllerAs: 'ctrl',
                template: require("./event-group-dialog.template.html"),
                parent: this.$document.parent(),
                clickOutsideToClose: false,
                escapeToClose: true,
                locals: {
                    jobId,
                    eventTypeGroups,
                    users
                },
                bindToController: true,
            });
            
            this.$log.debug('EventGroupDialogService: Dialog closed');
        } catch (error) {
            if(!error)  return;
            this.$log.error('EventGroupDialogService: Error in openEventGroupDialog', error);
            throw error;
        }
    }
}
