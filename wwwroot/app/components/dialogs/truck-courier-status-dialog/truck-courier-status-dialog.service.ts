import TruckCourierStatusDialogController from "./truck-courier-status-dialog.controller";
import {ITruckCourierStatus} from "../../../interfaces/courier.interface";
import DispatchCoreService from "../../../services/dispatch-core.service";

class TruckCourierStatusDialogService implements angular.IServiceProvider {
    static $inject = [
        '$mdDialog',
        '$document',
        '$log',
    ];

    constructor(
        private $mdDialog: angular.material.IDialogService,
        private $document: angular.IDocumentService,
        private $log: angular.ILogService,
    ) {
        this.$log.debug('TruckCourierStatusDialogService: Service instantiated');
    }

    $get(): any {
        return this;
    }

    async showTruckLoadingStatus($event: MouseEvent, truckCourierStatus: ITruckCourierStatus) {
        await this.$mdDialog
            .show({
                template: require("./truck-courier-status-dialog.template.html"),
                controller: TruckCourierStatusDialogController,
                controllerAs: "ctrl",
                parent: this.$document.parent(),
                targetEvent: $event,
                clickOutsideToClose: false,
                locals: {
                    truckCourierStatus,
                }
            });
    }
}

export default TruckCourierStatusDialogService;
