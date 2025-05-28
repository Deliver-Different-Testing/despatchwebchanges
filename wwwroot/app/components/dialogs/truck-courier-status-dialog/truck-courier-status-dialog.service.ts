import TruckCourierStatusDialogController from "./truck-courier-status-dialog.controller";
import {TruckCourierStatusViewModel} from "../../../interfaces/courier.interface";

class TruckCourierStatusDialogService implements angular.IServiceProvider {
    static $inject = [
        '$mdDialog',
        '$document'
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

    async showTruckLoadingStatus($event: MouseEvent, truckCourierStatus: TruckCourierStatusViewModel) {
        await this.$mdDialog
            .show({
                controller: TruckCourierStatusDialogController,
                controllerAs: "ctrl",
                parent: this.$document.parent(),
                targetEvent: $event,
                templateUrl: require("./truck-courier-status-dialog.html"),
                clickOutsideToClose: false,
                fullscreen: false,
                locals: {
                    truckCourierStatus,
                },
                bindToController: true,
            });
    }
}

export default TruckCourierStatusDialogService;
