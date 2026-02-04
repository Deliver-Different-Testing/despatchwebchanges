import TruckCourierStatusDialogController from "./truck-courier-status-dialog.controller";
import {ITruckCourierStatus} from "../../../interfaces/courier.interface";
import DispatchCoreService from "../../../services/dispatch-core.service";
import angular from 'angular';

class TruckCourierStatusDialogService implements angular.IServiceProvider {
    static $inject = [
        '$mdDialog',
        '$document',
    ];

    constructor(
        private $mdDialog: angular.material.IDialogService,
        private $document: angular.IDocumentService,
    ) {
        console.log('TruckCourierStatusDialogService: Service instantiated');
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
                },
                bindToController: true,
                fullscreen: true,
            });
    }
}

export default TruckCourierStatusDialogService;
