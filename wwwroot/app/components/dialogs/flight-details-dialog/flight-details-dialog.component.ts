import { IFlightViewModel, IFlightSegment } from "../../Nationwide/nationwide.interfaces";
import "./flight-details-dialog.styles.less";
import BaseController from "../../base-controller";
import dayjs from "dayjs";

class FlightDetailsDialogController extends BaseController {
    static $inject = [
        '$mdDialog',
        'flightData'
    ];

    flight: IFlightViewModel;
    isLoading: boolean = false;
    timeZone: string = TimeZone;
    selectedTabIndex: number = 0;
    currentSegment: IFlightSegment;
    isDisplayingOverview: boolean = true;

    constructor(
        private $mdDialog: angular.material.IDialogService,
        flightData: IFlightViewModel
    ) {
        super();
        this.flight = flightData;

        // Initialize with an overview or first segment
        if (this.flight.isMultiSegment && this.flight.flightSegments && this.flight.flightSegments.length > 0) {
            this.currentSegment = this.flight.flightSegments[0];
        } else {
            // Create a pseudo-segment from the main flight data for non-segmented flights
            this.currentSegment = {
                segmentOrder: 0,
                carrierFsCode: this.flight.flightNumber.substring(0, 2),
                flightNumber: this.flight.flightNumber.substring(2),
                departureTime: this.flight.departureTime,
                arrivalTime: this.flight.arrivalTime,
                departureAirportFsCode: this.flight.departureAirport,
                arrivalAirportFsCode: this.flight.arrivalAirport,
                flightEquipmentIataCode: '',
                elapsedTime: this.flight.elapsedTime || 0,
                stopsInSegment: 0
            };
        }
    }

    selectSegment(index: number): void {
        this.selectedTabIndex = index;

        // Only change this flag when switching to overview
        this.isDisplayingOverview = index === 0;

        // Always update the current segment for details display
        if (this.flight.flightSegments && this.flight.flightSegments.length > 0) {
            // For tab 0, use the first segment
            const segmentIndex = index === 0 ? 0 : index - 1;

            if (segmentIndex < this.flight.flightSegments.length) {
                this.currentSegment = this.flight.flightSegments[segmentIndex];
            }
        }
    }


    getFlightTotalDuration(): string {
        if (this.flight.elapsedTime) {
            const hours = Math.floor(this.flight.elapsedTime / 60);
            const mins = this.flight.elapsedTime % 60;
            return `${hours}h ${mins < 10 ? '0' + mins : mins}m`;
        }

        // Fallback to calculating from duration
        if (this.flight.duration) {
            const durationStr = this.flight.duration.toString();
            const matches = durationStr.match(/(\d+):(\d+):(\d+)/);
            if (matches && matches.length >= 4) {
                const hours = parseInt(matches[1]);
                const mins = parseInt(matches[2]);
                return `${hours}h ${mins < 10 ? '0' + mins : mins}m`;
            }
        }

        return 'N/A';
    }

    getSegmentDuration(): string {
        if (this.isDisplayingOverview) {
            return this.getFlightTotalDuration();
        }

        if (this.currentSegment && this.currentSegment.elapsedTime) {
            const hours = Math.floor(this.currentSegment.elapsedTime / 60);
            const mins = this.currentSegment.elapsedTime % 60;
            return `${hours}h ${mins < 10 ? '0' + mins : mins}m`;
        }

        return 'N/A';
    }

    getConnectionTime(firstSegment: IFlightSegment, secondSegment: IFlightSegment): string {
        if (!firstSegment || !secondSegment) return '';

        // Calculate time difference in minutes
        const firstArrival = firstSegment.arrivalTime;
        const secondDeparture = secondSegment.departureTime;
        const diffMinutes = secondDeparture.diff(firstArrival, 'minutes');

        // Format as hours and minutes
        const hours = Math.floor(diffMinutes / 60);
        const mins = diffMinutes % 60;

        if (hours > 0) {
            return hours + 'h ' + (mins < 10 ? '0' + mins : mins) + 'm';
        } else {
            return mins + 'm';
        }
    }

    cancel(): void {
        this.$mdDialog.cancel();
    }
}

export default FlightDetailsDialogController;
