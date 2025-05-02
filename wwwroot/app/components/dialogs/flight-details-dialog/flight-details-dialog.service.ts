import NationwideService from "../../Nationwide/nationwide.service";
import FlightDetailsDialogController from "./flight-details-dialog.component";

class FlightDetailsDialogService implements angular.IServiceProvider {
    static $inject = [
        '$mdDialog',
        '$document',
        'NWData',
    ];

    constructor(
        private $mdDialog: angular.material.IDialogService,
        private $document: angular.IDocumentService,
        private nationwideService: NationwideService,
    ) {
        console.log('FlightDetailsDialogService: Service instantiated');
    }

    $get() {
        return this;
    }

    async openFlightDetailsDialog($event: MouseEvent, flightNumber: string, departureDate: Date, correctConnectionNumber: number) {
        const flightConnections = await this.nationwideService.getFlightConnectionsInfoForDialog(flightNumber, departureDate);

        await this.$mdDialog.show({
            controller: FlightDetailsDialogController,
            controllerAs: 'ctrl',
            template: require('./flight-details-dialog.template.html'),
            parent: this.$document.parent(),
            targetEvent: $event,
            clickOutsideToClose: false,
            locals: {
               flightConnections,
                correctConnectionNumber
            }
        });
    }
}

export default FlightDetailsDialogService;
