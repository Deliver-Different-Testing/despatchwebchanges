import "./flight-agent-confirmation-dialog.layout.less";
import BaseController from "../../base-controller";
import {FlightSegmentViewModel, IFlightViewModel} from "../../Nationwide/nationwide.interfaces";
import {Suggestion} from "../../../interfaces/job.interface";
import getDangerousGoodsClassName from "../../../functions/getDangerousGoodsClassName";
import {FlightAgentConfirmationDialogResult} from "../../../interfaces/dialog-result.interfaces";
import NationwideService from "../../Nationwide/nationwide.service";
import {AvailableTime, CargoIndicator, CargoStatus} from "./interfaces/ICargoStatus";
import IFlightCargoProcessing from "./interfaces/IFlightCargoProcessing";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import ToastrService from "../../../services/toastr.service";
import {formatMins} from "../../../functions/formatDates";

dayjs.extend(duration);

class FlightAgentConformationDialogController extends BaseController {
    static $inject = [
        '$mdDialog',
        'NWData',
        'toastrService',
        'jobId',
        'jobNumber',
        'flight',
        'agent',
        'existingAwb',
        'dgClass',
        'stopJobCount',
    ];

    // Existing properties
    isAwbDisabled: boolean = false;
    awb: string = '';
    dialogTitle?: string;
    dgClassName?: string;
    showIncludeStopJobs: boolean = false;
    assignToStopJobs: boolean = false;
    loadingAlerts: boolean = false;

    // Enhanced properties
    packageReadyTime?: Date;
    deliveryByTime?: Date;
    deliveryNotes?: string;
    currentScenarioDescription?: string;
    showWarning: boolean = false;
    warningTitle?: string;
    warningMessage?: string;
    nextMorningTime: string = '';
    departureTimeZone?: string;
    arrivalTimeZone?: string;
    isCalculatingTimes: boolean = false;

    // Flight segment data for display
    departureAirport?: string;
    arrivalAirport?: string;
    departureTime?: Date;
    arrivalTime?: Date;
    flightNumber?: string;

    packageTimeEditEnabled: boolean = false;

    // Cargo processing data from the backend
    cargoProcessing?: IFlightCargoProcessing;

    // Status objects
    cargoStatus?: CargoStatus;
    cargoIndicator?: CargoIndicator;
    availableTime?: AvailableTime;

    constructor(
        private $mdDialog: angular.material.IDialogService,
        private nationwideService: NationwideService,
        private toastrService: ToastrService,
        public jobId: number,
        public jobNumber: string,
        public flight?: IFlightViewModel,
        public agent?: Suggestion,
        private existingAwb?: string,
        private dgClass?: number,
        private stopJobCount?: number,
    ) {
        super();
        console.log('FlightAgentConformationDialog initialized');
    }

    $onInit() {
        console.log('FlightAgentConformationDialog $onInit started');

        // Set dialog title
        this.dialogTitle = this.flight ? 'Assign Flight' : 'Assign Agent';
        if (this.flight) {
            this.dialogTitle += ` - ${this.flight.flightNumber}`;
        } else if (this.agent) {
            this.dialogTitle += ` - ${this.agent.text}`;
        }

        // Configure stop jobs
        this.showIncludeStopJobs = (this.stopJobCount !== undefined && this.stopJobCount > 0);

        // Set dangerous goods class name
        if (this.dgClass !== undefined) {
            this.dgClassName = getDangerousGoodsClassName(this.dgClass);
        }

        // Configure AWB
        if (this.existingAwb) {
            this.awb = this.existingAwb;
            this.isAwbDisabled = true;
        }

        // Initialize loading states for cargo processing
        if (this.flight) {
            this.initializeLoadingStates();
        }

        // Process flight segments and calculate times
        if (this.flight && this.flight.flightSegments && this.flight.flightSegments.length > 0) {
            console.log('Processing flight segments:', this.flight.flightSegments);
            this.processFlightData();
        } else if (this.flight) {
            const warningMessage = 'Flight found but no flight segments available';
            this.toastrService.showWarningToast(warningMessage);
        }

        this.applyScope();
        console.log('FlightAgentConformationDialog $onInit completed');
    }

    private initializeLoadingStates(): void {
        this.cargoStatus = {
            class: 'cargo-loading',
            icon: 'schedule',
            hours: 'Loading...',
            text: 'Loading cargo information...'
        };

        this.cargoIndicator = {
            class: 'cargo-indicator loading',
            icon: 'schedule',
            text: 'Loading...'
        };

        this.availableTime = {
            class: 'time-loading',
            icon: 'schedule',
            text: 'Loading...',
            subtext: 'Calculating times...'
        };
    }

    private async processFlightData() {
        if (!this.flight?.flightSegments || this.flight.flightSegments.length === 0) {
            this.toastrService.showErrorToast('No flight segments available');
            return;
        }

        // Sort flight segments by segment order
        const sortedSegments = this.flight.flightSegments.sort((a, b) => a.segmentOrder - b.segmentOrder);
        const firstFlight = sortedSegments[0];
        const lastFlight = sortedSegments[sortedSegments.length - 1];

        // Extract display information
        this.departureAirport = firstFlight.departureAirportFsCode;
        this.arrivalAirport = lastFlight.arrivalAirportFsCode;

        this.departureTime = firstFlight.departureTime;
        this.arrivalTime = lastFlight.arrivalTime;

        this.flightNumber = this.flight.flightNumber;

        this.departureTimeZone = firstFlight.departureAirportTimeZone;
        this.arrivalTimeZone = lastFlight.arrivalAirportTimeZone;

        // Calculate cargo processing times
        await this.calculateCargoProcessingTimes(lastFlight);
    }

    private async calculateCargoProcessingTimes(lastFlight: FlightSegmentViewModel): Promise<void> {
        if (!lastFlight.arrivalAirportId) {
            console.warn('No arrival airport ID found for cargo processing calculation');
            return;
        }

        console.log('Starting cargo processing calculation for:', {
            jobId: this.jobId,
            carrierFsCode: lastFlight.carrierFsCode,
            arrivalTime: lastFlight.arrivalTime,
            arrivalAirportId: lastFlight.arrivalAirportId
        });

        this.isCalculatingTimes = true;
        this.currentScenarioDescription = 'Calculating cargo processing times...';
        this.applyScope();

        try {
            const cargoProcessing = await this.nationwideService.calculateCargoReadyTime(
                this.jobId,
                lastFlight.carrierFsCode,
                lastFlight.arrivalTime
            );

            console.log('Cargo processing response received:', cargoProcessing);

            if (!cargoProcessing) {
                console.warn('Cargo processing response is null or undefined');
                this.handleCargoProcessingError();
                this.applyScope();
                return;
            }

            this.cargoProcessing = {
                ...cargoProcessing,
                arrivalTime: dayjs(cargoProcessing.arrivalTime).toDate(),
                arrivalWithProcessingTime: dayjs(cargoProcessing.arrivalWithProcessingTime).toDate(),
                cargoOpeningTime: dayjs(cargoProcessing.cargoOpeningTime).toDate(),
                cargoClosingTime: dayjs(cargoProcessing.cargoClosingTime).toDate(),
                packageReadyTime: dayjs(cargoProcessing.packageReadyTime).toDate(),
                deliverByTime: cargoProcessing.deliverByTime ?
                    dayjs(cargoProcessing.deliverByTime).toDate() : undefined
            };

            this.packageReadyTime = this.cargoProcessing.packageReadyTime;

            if (this.cargoProcessing.deliverByTime) {
                this.deliveryByTime = this.cargoProcessing.deliverByTime;
            }

            this.isCalculatingTimes = false;
            this.updateCargoHoursDisplay();
            this.evaluateCurrentScenario();

            console.log('Final state after processing:', {
                cargoStatus: this.cargoStatus,
                cargoIndicator: this.cargoIndicator,
                availableTime: this.availableTime,
                packageReadyTime: this.packageReadyTime,
                deliveryByTime: this.deliveryByTime
            });

        } catch (error) {
            console.error('Error calculating cargo processing times:', error);
            this.handleCargoProcessingError();
        } finally {
            this.isCalculatingTimes = false;
            this.applyScope();
        }
    }

    private handleCargoProcessingError(): void {
        this.cargoStatus = {
            class: 'cargo-error',
            icon: 'error',
            hours: 'Error',
            text: 'Failed to load cargo information'
        };

        this.cargoIndicator = {
            class: 'cargo-indicator invalid',
            icon: 'error',
            text: 'Unable to verify cargo hours'
        };

        this.availableTime = {
            class: 'time-critical',
            icon: 'error',
            text: 'Error',
            subtext: 'Unable to calculate times'
        };

        this.toastrService.showErrorToast('Failed to calculate cargo processing times');
        this.applyScope();
    }

    private updateCargoHoursDisplay(): void {
        if (!this.cargoProcessing || !this.cargoStatus) return;

        const openTime = formatMins(this.cargoProcessing.cargoOpeningTime);
        const closeTime = formatMins(this.cargoProcessing.cargoClosingTime);
        this.cargoStatus.hours = `${openTime} - ${closeTime}`;

        console.log('Updated cargo hours display using dayjs:', this.cargoStatus.hours);
    }

    evaluateCurrentScenario(): void {
        console.log('=== EVALUATING SCENARIO ===');
        console.log('isCalculatingTimes:', this.isCalculatingTimes);
        console.log('packageReadyTime:', this.packageReadyTime);
        console.log('deliveryByTime:', this.deliveryByTime);
        console.log('cargoProcessing exists:', !!this.cargoProcessing);

        if (this.isCalculatingTimes) {
            console.log('Still calculating - exiting early');
            this.currentScenarioDescription = 'Calculating cargo processing times...';
            return;
        }

        if (!this.packageReadyTime || !this.cargoProcessing) {
            console.log('Missing required data - exiting early');
            this.currentScenarioDescription = 'Waiting for cargo processing data';
            return;
        }

        console.log('Proceeding with full evaluation');
        const packageTime = this.packageReadyTime;

        const isWithinCargoHours = this.isPackageReadyWithinCargoHours();
        console.log('Package within cargo hours:', isWithinCargoHours);

        this.updateCargoStatus(isWithinCargoHours, packageTime);
        this.evaluateDeliveryScenario();
        this.updateScenarioDescription(isWithinCargoHours);

        console.log('=== EVALUATION COMPLETE ===');
        console.log('Final cargoStatus:', this.cargoStatus);
        console.log('Final cargoIndicator:', this.cargoIndicator);
        console.log('Final availableTime:', this.availableTime);
        console.log('Final showWarning:', this.showWarning);
        console.log('============================');

        this.applyScope();
    }

    private isPackageReadyWithinCargoHours(): boolean {
        if (!this.cargoProcessing || !this.packageReadyTime) {
            console.log('Missing cargoProcessing or packageReadyTime for hours check');
            return false;
        }

        console.log('Checking cargo hours with:', {
            packageReadyTime: this.packageReadyTime,
            cargoOpeningTime: this.cargoProcessing.cargoOpeningTime,
            cargoClosingTime: this.cargoProcessing.cargoClosingTime
        });

        const packageTime = formatMins(this.packageReadyTime);
        const openingTime = formatMins(this.cargoProcessing.cargoOpeningTime);
        const closingTime = formatMins(this.cargoProcessing.cargoClosingTime);

        console.log('Time comparison:', {
            packageTime,
            openingTime,
            closingTime,
            isWithinHours: packageTime >= openingTime && packageTime <= closingTime
        });

        return packageTime >= openingTime && packageTime <= closingTime;
    }

    private updateCargoStatus(isWithinCargoHours: boolean, packageTime: Date): void {
        if (!this.cargoStatus) return;

        if (isWithinCargoHours) {
            this.cargoStatus = {
                ...this.cargoStatus, // Preserve hours from cargo processing
                class: 'cargo-open',
                icon: 'check_circle',
                text: 'Open when package ready'
            };

            this.cargoIndicator = {
                class: 'cargo-indicator valid',
                icon: 'check_circle',
                text: 'Within cargo hours'
            };

            this.showWarning = false;
        } else {
            this.cargoStatus = {
                ...this.cargoStatus, // Preserve hours from cargo processing
                class: 'cargo-closed',
                icon: 'cancel',
                text: 'Closed when package ready'
            };

            this.cargoIndicator = {
                class: 'cargo-indicator invalid',
                icon: 'cancel',
                text: 'After cargo closes'
            };

            this.setupWarningCard(packageTime);
        }
    }

    private setupWarningCard(packageTime: Date): void {
        if (!this.cargoProcessing) return;

        this.showWarning = true;
        this.warningTitle = 'Package Available After Cargo Hours';

        const packageDayjs = dayjs(packageTime);
        const timeStr = packageDayjs.format('HH:mm');
        const closingTime = dayjs(this.cargoProcessing.cargoClosingTime).format('HH:mm');

        this.warningMessage = `Package available at ${timeStr} but cargo facility closes at ${closingTime}. Choose an option:`;

        const nextMorning = this.calculateNextMorningTime(packageDayjs);
        this.nextMorningTime = `${nextMorning.format('MMM D')}, ${nextMorning.format('HH:mm')} (Cargo Opens)`;
    }

    private calculateNextMorningTime(packageTime: dayjs.Dayjs): dayjs.Dayjs {
        if (!this.cargoProcessing) return packageTime;

        let nextMorning = packageTime.add(1, 'day');
        const cargoOpening = dayjs(this.cargoProcessing.cargoOpeningTime);

        return nextMorning
            .hour(cargoOpening.hour())
            .minute(cargoOpening.minute())
            .second(0)
            .millisecond(0);
    }

    private evaluateDeliveryScenario(): void {
        console.log('Evaluating delivery scenario...');

        if (!this.deliveryByTime) {
            this.availableTime = {
                class: 'time-warning',
                icon: 'warning',
                text: 'Set delivery time',
                subtext: 'Time not calculated'
            };
            console.log('No delivery time set - showing warning');
            return;
        }

        if (!this.packageReadyTime) {
            this.availableTime = {
                class: 'time-critical',
                icon: 'error',
                text: 'Invalid times',
                subtext: 'Package ready time not available'
            };
            console.log('No package ready time - showing error');
            return;
        }

        const deliveryDayjs = dayjs(this.deliveryByTime);
        const packageDayjs = dayjs(this.packageReadyTime);
        const diffMinutes = deliveryDayjs.diff(packageDayjs, 'minute');

        console.log('Time calculation:', {
            deliveryTime: deliveryDayjs.format('YYYY-MM-DD HH:mm'),
            packageTime: packageDayjs.format('YYYY-MM-DD HH:mm'),
            diffMinutes
        });

        this.updateAvailableTimeDisplay(diffMinutes);
    }

    private updateAvailableTimeDisplay(diffMinutes: number): void {
        if (!this.availableTime) return;

        console.log(`Updating available time display: ${diffMinutes} minutes`);

        if (diffMinutes < 0) {
            this.availableTime = {
                class: 'time-critical',
                icon: 'cancel',
                text: 'Invalid timing',
                subtext: 'Delivery before package ready'
            };
        } else if (diffMinutes < 30) {
            this.availableTime = {
                class: 'time-critical',
                icon: 'cancel',
                text: `${diffMinutes} minutes`,
                subtext: 'Insufficient time'
            };
        } else if (diffMinutes < 90) {
            this.availableTime = {
                class: 'time-warning',
                icon: 'warning',
                text: `${diffMinutes} minutes`,
                subtext: 'Tight timeline'
            };
        } else {
            let timeText = `${diffMinutes} minutes`;

            if (diffMinutes >= 60) {
                const duration = dayjs.duration(diffMinutes, 'minutes');
                const hours = Math.floor(duration.asHours());
                const mins = duration.minutes();
                timeText = mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
            }

            this.availableTime = {
                class: 'time-sufficient',
                icon: 'check_circle',
                text: timeText,
                subtext: 'Sufficient time'
            };
        }

        console.log('Available time updated to:', this.availableTime);
    }

    private updateScenarioDescription(isWithinCargoHours: boolean): void {
        if (this.isCalculatingTimes) {
            this.currentScenarioDescription = 'Calculating cargo processing times...';
            return;
        }

        let description = isWithinCargoHours ?
            'Normal - Package ready within cargo hours' :
            'Warning - Package ready after cargo hours';

        if (!this.deliveryByTime) {
            description += ' - No delivery time set';
        } else if (this.availableTime?.class === 'time-critical') {
            description += ' - Critical timing issues';
        } else if (this.availableTime?.class === 'time-warning') {
            description += ' - Tight delivery schedule';
        }

        this.currentScenarioDescription = description;

        console.log('Updated scenario description using dayjs:', this.currentScenarioDescription);
    }

    onTimeChange(): void {
        console.log('onTimeChange called');
        this.evaluateCurrentScenario();
    }

    editPackageTime(): void {
        this.packageTimeEditEnabled = !this.packageTimeEditEnabled;
        this.applyScope();
    }

    setDeliveryTime(): void {
        if (!this.deliveryByTime && this.packageReadyTime) {
            const packageTime = dayjs(this.packageReadyTime);
            if (packageTime.isValid()) {
                this.deliveryByTime = packageTime.add(4, 'hour').toDate();
                this.evaluateCurrentScenario();
            }
        }

        this.applyScope();
    }

    setNextMorning(): void {
        if (!this.packageReadyTime || !this.cargoProcessing) return;

        const packageTime = dayjs(this.packageReadyTime);
        if (!packageTime.isValid()) return;

        const nextMorning = this.calculateNextMorningTime(packageTime);
        this.packageReadyTime = nextMorning.toDate();

        if (this.deliveryByTime) {
            const deliveryTime = dayjs(this.deliveryByTime);
            if (deliveryTime.isValid()) {
                const timeDiffMs = deliveryTime.diff(packageTime, 'millisecond');
                this.deliveryByTime = nextMorning.add(timeDiffMs, 'millisecond').toDate();
            }
        }

        this.evaluateCurrentScenario();
        this.applyScope();
    }

    setBaggagePickup(): void {
        this.deliveryNotes = 'COLLECT FROM BAGGAGE CAROUSEL - Package available after cargo hours. ' +
            'Check baggage claim area for collection. Contact ground services if assistance needed.';
        this.showWarning = false;
        this.applyScope();
    }

    confirm(): void {
        const response: FlightAgentConfirmationDialogResult = {
            awb: this.awb,
            shouldAssignToStopJobs: this.assignToStopJobs,
            packageReadyTime: this.packageReadyTime,
            packageDeliverByTime: this.deliveryByTime,
            packageDeliveryNotes: this.deliveryNotes,
        };

        console.log('Enhanced flight assignment confirmed:', {
            ...response,
            jobNumber: this.jobNumber,
            flightNumber: this.flightNumber,
            agentName: this.agent?.text,
            deliveryNotes: this.deliveryNotes,
            packageReadyTime: this.packageReadyTime,
            deliveryByTime: this.deliveryByTime,
            scenarioStatus: this.currentScenarioDescription,
            cargoStatus: this.cargoStatus,
            timeCalculations: this.availableTime,
            cargoProcessing: this.cargoProcessing
        });

        this.$mdDialog.hide(response);
    }

    cancel(): void {
        this.$mdDialog.cancel();
    }
}

export default FlightAgentConformationDialogController;