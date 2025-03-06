import app from "../../../app";
import {EventGroupViewModel} from "./event-group-dialog.controller";
import template from "./event-group-dialog.template.html";
import DispatchService from "../../../services/dispatch.service";

export class EventGroupDialogService {
    static $inject = [
        '$mdDialog', "DispatchData"
    ];

    constructor(
        private $mdDialog: angular.material.IDialogService,
        private DispatchData: DispatchService
    ) {
        console.log('EventGroupDialogService: Service instantiated');
    }

    async openEventGroupDialog(eventGroupId: number) {
        console.log(`EventGroupDialogService: Opening dialog for event group ID: ${eventGroupId}`);

        try {
            console.log('EventGroupDialogService: Fetching event type groups');
            const eventTypeGroups = await this.DispatchData.getEventTypeGroups(eventGroupId);
            console.log('EventGroupDialogService: Event type groups fetched successfully', eventTypeGroups);

            const users: any[] = []; // ToDo: Put the assignable users in
            console.log('EventGroupDialogService: Users array prepared', users);

            console.log('EventGroupDialogService: Showing dialog');
            await this.$mdDialog.show({
                controller: 'EventGroupDialogController',
                controllerAs: 'ctrl',
                template: template,
                parent: document.body,
                clickOutsideToClose: false,
                escapeToClose: true,
                locals: {
                    eventTypeGroups,
                    users
                },
                bindToController: true,
            });
            console.log('EventGroupDialogService: Dialog closed');
        } catch (error) {
            console.error('EventGroupDialogService: Error in openEventGroupDialog', error);
            throw error; // Re-throw to allow caller to handle
        }
    }
}

app.service('eventGroupDialogService', EventGroupDialogService);
