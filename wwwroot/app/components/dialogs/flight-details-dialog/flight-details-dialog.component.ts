import {FlightDetailsViewModel} from "./flight-details-dialog.interfaces";
import "./flight-details-dialog.styles.less";

class FlightDetailsDialogController {
    static $inject = [
        '$mdDialog',
        'flightInfo',
    ];

    flightViewModel: FlightDetailsViewModel | null = null;
    isLoading: boolean = false;
    error: string = '';
    timeZone: string = TimeZone;
    showCodeshares: boolean = false;

    constructor(
        private $mdDialog: angular.material.IDialogService,
        flightInfo: FlightDetailsViewModel
    ) {
        this.flightViewModel = flightInfo;
    }

    toggleCodeshares(): void {
        this.showCodeshares = !this.showCodeshares;
    }

    hasCodeshares(): boolean {
        return !!(this.flightViewModel && this.flightViewModel.codeShares && this.flightViewModel.codeShares.length > 0);
    }

    getServiceClassesFormatted(): string {
        if (!this.flightViewModel || !this.flightViewModel.serviceClasses) return 'N/A';
        return this.flightViewModel.serviceClasses.join(', ');
    }

    cancel(): void {
        this.$mdDialog.cancel();
    }
}

export default FlightDetailsDialogController;
