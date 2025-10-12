import {MapDialogController} from "./map-dialog.controller";
import {OverviewTableParentJob} from "../../overview/overview.interfaces";

class MapDialogService implements  angular.IServiceProvider {
    static $inject = [
        '$mdDialog',
        '$document',
    ];
    
    constructor(
        private $mdDialog: angular.material.IDialogService,
        private $document: angular.IDocumentService,
    ) {
        console.debug('MapDialogService: Service instantiated');
    }
    
    $get() {
        return this;
    }
    
    async openMapDialog($event: MouseEvent, delivery: OverviewTableParentJob) {
        await this.$mdDialog.show({
            controller: MapDialogController,
            controllerAs: "ctrl",
            template: require("./map-dialog.template.html"),
            parent: this.$document.parent(),
            clickOutsideToClose: true,
            fullscreen: true,
            targetEvent: $event,
            locals: {
                delivery,
            },
            bindToController: true,
        });
    }
}

export default MapDialogService;