import EditAfterhoursDialogController from "./edit-afterhours-dialog.controller";
import {IAfterHoursCourierSchedule} from "../../driver-management-dashboard/interfaces/IAfterHoursCourierSchedule";

class EditAfterhoursDialogService implements angular.IServiceProvider {
    static $inject = [
        '$mdDialog',
        '$document',
        '$log',
    ];

    constructor(
        private $mdDialog: angular.material.IDialogService,
        private $document: angular.IDocumentService,
        private $log: angular.ILogService) {
        this.$log.debug('EditAfterhoursDialogService: Service instantiated');
    }

    $get() {
        return this;
    }

    async openEditAfterhoursDialog($event: MouseEvent, afterHourScheduleItem: IAfterHoursCourierSchedule): Promise<IAfterHoursCourierSchedule | undefined> {
        try {
            this.$log.debug('EditAfterhoursDialogService: Opening dialog for schedule:', afterHourScheduleItem);

            const dialogConfig: angular.material.IDialogOptions = {
                controller: EditAfterhoursDialogController,
                controllerAs: 'ctrl',
                template: require("./edit-afterhours-dialog.template.html"),
                parent: this.$document.parent(),
                targetEvent: $event,
                clickOutsideToClose: false,
                escapeToClose: true,
                fullscreen: true,
                hasBackdrop: true,
                locals: {
                    afterHourScheduleItem
                },
                bindToController: true,
            };

            const result = await this.$mdDialog.show(dialogConfig);
            this.$log.debug('EditAfterhoursDialogService: Dialog resolved with:', result);
            return result;
        } catch (error) {
            throw error;
        }
    }
}

export default EditAfterhoursDialogService;