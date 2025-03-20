import DispatchCoreService from "../../../services/dispatch-core.service";
import {EventGroupDialogController} from "./event-group-dialog.controller";

export class EventGroupDialogService {
    static $inject = [
        '$mdDialog', "DispatchData"
    ];

    constructor(
        private $mdDialog: angular.material.IDialogService,
        private DispatchData: DispatchCoreService,
    ) {
        console.log('EventGroupDialogService: Service instantiated');
    }

    async openEventGroupDialog(eventGroupId: number, jobId: number) {
        try {
            const eventTypeGroups = await this.DispatchData.getEventTypeGroups(eventGroupId);
            const users = await this.DispatchData.getActiveStaff();

            await this.$mdDialog.show({
                controller: EventGroupDialogController,
                controllerAs: 'ctrl',
                template: require("./event-group-dialog.template.html"),
                parent: document.body,
                clickOutsideToClose: false,
                escapeToClose: true,
                locals: {
                    jobId,
                    eventTypeGroups,
                    users
                },
                bindToController: true,
            });
            console.log('EventGroupDialogService: Dialog closed');
        } catch (error) {
            if(error === undefined) {
                return;
            }

            // Error occured
            console.error('EventGroupDialogService: Error in openEventGroupDialog', error);
            throw error;
        }
    }
}
