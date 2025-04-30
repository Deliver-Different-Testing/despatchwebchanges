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

        // Initialize with the first flight connection if available
        if (this.flightConnections && this.flightConnections.length > 0) {
            this.flightViewModel = this.flightConnections[0];
        }
    }

    selectConnection(index: number): void {
        if (this.flightConnections && this.flightConnections[index]) {
            this.flightViewModel = this.flightConnections[index];
            this.selectedTabIndex = index;
            // Reset codeshare visibility when switching connections
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

        // If only one connection, return its duration
        if (this.flightConnections.length === 1) {
            return this.flightConnections[0].duration;
        }

        // For multiple connections, calculate total duration if possible
        // This is a simplified implementation and might need adjustment based on how durations are formatted
        // Assuming duration is in format "HH:MM"
        try {
            let totalMinutes = 0;

            this.flightConnections.forEach(connection => {
                const durationParts = connection.duration.split(':');
                if (durationParts.length === 2) {
                    const hours = parseInt(durationParts[0]);
                    const minutes = parseInt(durationParts[1]);
                    totalMinutes += (hours * 60) + minutes;
                }
            });

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
