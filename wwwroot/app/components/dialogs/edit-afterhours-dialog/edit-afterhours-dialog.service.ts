import EditAfterhoursDialogController from "./edit-afterhours-dialog.controller";
import {IAfterHoursCourierSchedule} from "../../driver-management-dashboard/interfaces/IAfterHoursCourierSchedule";

class EditAfterhoursDialogService implements angular.IServiceProvider {
    static $inject = [
        '$mdDialog',
        '$document'
    ];

    constructor(
        private $mdDialog: angular.material.IDialogService,
        private $document: angular.IDocumentService,
    ) {
        console.log('EditAfterhoursDialogService: Service instantiated');
    }

    $get() {
        return this;
    }

    async openEditAfterhoursDialog($event: MouseEvent, afterHourScheduleItem: IAfterHoursCourierSchedule): Promise<IAfterHoursCourierSchedule | undefined> {
        try {
            console.log('EditAfterhoursDialogService: Opening dialog for schedule:', afterHourScheduleItem);

            const dialogConfig: angular.material.IDialogOptions = {
                controller: EditAfterhoursDialogController,
                controllerAs: 'ctrl',
                template: require("./edit-afterhours-dialog.template.html"),
                parent: this.$document.parent(),
                targetEvent: $event,
                clickOutsideToClose: true,
                escapeToClose: true,
                fullscreen: true,
                hasBackdrop: true,
                locals: {
                    afterHourScheduleItem
                },
                bindToController: true,
            };

            const result = await this.$mdDialog.show(dialogConfig);
            console.log('EditAfterhoursDialogService: Dialog resolved with:', result);
            return result;
        } catch (error) {
            console.error("An error occurred in afterhours dialog: " + error);
            throw error;
        }
    }
}

export default EditAfterhoursDialogService;