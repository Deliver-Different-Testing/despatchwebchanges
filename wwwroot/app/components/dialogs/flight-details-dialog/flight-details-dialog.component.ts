import {FlightDetailsViewModel} from "./flight-details-dialog.interfaces";
import "./flight-details-dialog.styles.less";
import BaseController from "../../base-controller";

class FlightDetailsDialogController extends BaseController {
    static $inject = [
        '$mdDialog',
        'flightConnections',
    ];

    flightViewModel: FlightDetailsViewModel | null = null;
    isLoading: boolean = false;
    error: string = '';
    timeZone: string = TimeZone;
    showCodeshares: boolean = false;
    selectedTabIndex: number = 0;

    constructor(
        private $mdDialog: angular.material.IDialogService,
        public flightConnections: FlightDetailsViewModel[]
    ) {
        super();
        console.log('FlightDetailsDialogController: Service instantiated');
    }

    $onInit() {
        // Initialize with the first flight connection if available
        if (this.flightConnections && this.flightConnections.length > 0) {
            this.flightViewModel = this.flightConnections[0];
        }
    }

    selectConnection(index: number): void {
        if (this.flightConnections && this.flightConnections[index]) {
            this.flightViewModel = this.flightConnections[index];
            this.selectedTabIndex = index;
            this.showCodeshares = false;
        }
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

    getConnectionLabel(index: number): string {
        if (!this.flightConnections || !this.flightConnections[index]) return `Connection ${index + 1}`;

        const connection = this.flightConnections[index];
        return `${connection.origin.code} - ${connection.destination.code}`;
    }

    getTotalDuration(): string {
        if (!this.flightConnections || this.flightConnections.length === 0) return 'N/A';

        if (this.flightConnections.length === 1) {
            return this.flightConnections[0].duration;
        }

        try {
            const firstFlight = this.flightConnections[0];
            const lastFlight = this.flightConnections[this.flightConnections.length - 1];

            const departureTime = new Date(firstFlight.departureTime);
            const arrivalTime = new Date(lastFlight.arrivalTime);

            const diffMs = arrivalTime.getTime() - departureTime.getTime();
            const totalMinutes = Math.floor(diffMs / (1000 * 60));
            const hours = Math.floor(totalMinutes / 60);
            const minutes = totalMinutes % 60;

            return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        } catch (e) {
            console.error('Error calculating total duration:', e);
            return 'N/A';
        }
    }

    cancel(): void {
        this.$mdDialog.cancel();
    }
}

export default FlightDetailsDialogController;
