import { IFlightViewModel } from "../../Nationwide/nationwide.interfaces";
import FlightDetailsDialogController from "./flight-details-dialog.component";

class FlightDetailsDialogService implements angular.IServiceProvider {
    static $inject = [
        '$mdDialog',
        '$document',
    ];

    constructor(
        private $mdDialog: angular.material.IDialogService,
        private $document: angular.IDocumentService,
    ) {
        console.log('FlightDetailsDialogService: Service instantiated');
    }

    $get() {
        return this;
    }

    async openFlightDetailsDialog($event: MouseEvent, flightData: IFlightViewModel) {
        // Don't need to make an additional API call since we already have the flight data
        await this.$mdDialog.show({
            template: require('./flight-details-dialog.template.html'),
            controller: FlightDetailsDialogController,
            controllerAs: 'ctrl',
            parent: this.$document.parent(),
            targetEvent: $event,
            clickOutsideToClose: true,
            escapeToClose: true,
            locals: {
                flightData
            },
            bindToController: true,
            fullscreen: true,
        });
    }
}

export default FlightDetailsDialogService;
