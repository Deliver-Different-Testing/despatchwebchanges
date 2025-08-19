import "./flight-agent-confirmation-dialog.layout.less";
import BaseController from "../../base-controller";
import {IFlightViewModel} from "../../Nationwide/nationwide.interfaces";
import {Suggestion} from "../../../interfaces/job.interface";
import getDangerousGoodsClassName from "../../../functions/getDangerousGoodsClassName";
import {FlightAgentConfirmationDialogResult} from "../../../interfaces/dialog-result.interfaces";
import NationwideService from "../../Nationwide/nationwide.service";
import dayjs from "dayjs";

class FlightAgentConformationDialogController extends BaseController {
    static $inject = [
        '$mdDialog',
        'NWData',
        'jobId',
        'jobNumber',
        'flight',
        'agent',
        'toAirportId',
        'existingAwb',
        'dgClass',
        'stopJobCount',
    ];

    isAwbDisabled: boolean = false;
    awb: string = '';
    dialogTitle: string;
    dgClassName?: string;
    showIncludeStopJobs: boolean;
    assignToStopJobs: boolean = false;
    enabledAlerts?: Suggestion[];
    currentDeliverByTime?: Date;
    overrideDeliverByTime?: boolean = false;
    loadingAlerts: boolean = false;
    flightCargoProcessing?: IFlightCargoProcessing;
    isDeliveryByTimeBad: boolean = false;
    generatedDeliverByTime?: Date;

    constructor(
        private $mdDialog: angular.material.IDialogService,
        private nationwideService: NationwideService,
        private jobId: number,
        public jobNumber: string,
        public flight?: IFlightViewModel,
        public agent?: Suggestion,
        private toAirportId?: number,
        existingAwb?: string,
        dgClass?: number,
        stopJobCount?: number,
    ) {
        super();

        this.dialogTitle = flight ? 'Assign Flight' : 'Assign Agent';
        this.showIncludeStopJobs = (stopJobCount !== undefined && stopJobCount > 0);

        if (dgClass !== undefined) {
            this.dgClassName = getDangerousGoodsClassName(dgClass);
        }

        if (existingAwb) {
            this.awb = existingAwb;
            this.isAwbDisabled = true;
        }
    }

    $onInit() {
        console.log('FlightAgentConformationDialogController: Controller initialized');

        if (this.flight) {
            this.generateNewDeliverByTimeFromFlight();

            this.getEnabledAlertEvents()
                .then(() => this.getDeliverByTime())
                .then(() => this.calculateCargoReadyTime())
                .catch(error => {
                    console.error('Error during initialization:', error);
                });

            if (this.currentDeliverByTime) this.checkDeliverTimeAcceptable();
            else this.overrideDeliverByTime = true;
        }
    }

    async getEnabledAlertEvents(): Promise<void> {
        this.loadingAlerts = true;
        try {
            this.enabledAlerts = await this.nationwideService.getEnabledWebhookEvents();
        } catch (error) {
            console.error('Failed to load webhook alerts:', error);
            this.enabledAlerts = [];
        } finally {
            this.loadingAlerts = false;
            this.applyScope();
        }
    }

    async getDeliverByTime(): Promise<void> {
        try {
            this.currentDeliverByTime = await this.nationwideService.getDeliveryByTimeForJob(this.jobId);
        } catch (error) {
            console.error('Failed to load delivery by time:', error);
            this.currentDeliverByTime = undefined;
        } finally {
            this.applyScope();
        }
    }

    async calculateCargoReadyTime(): Promise<void> {
        if (!this.flight?.arrivalTime || !this.toAirportId) return;

        try {
            this.flightCargoProcessing = await this.nationwideService.calculateCargoReadyTime(this.toAirportId,
                this.flight?.flightNumber, this.flight?.arrivalTime);
        } catch (error) {
            console.error('Failed to calculate flight arrival time:', error);
        } finally {
            this.applyScope();
        }
    }

    generateNewDeliverByTimeFromFlight(): void {
        this.generatedDeliverByTime = dayjs(this.currentDeliverByTime).add(3, 'hour').toDate();
    }

    checkDeliverTimeAcceptable(): void {
        if (!this.currentDeliverByTime || !this.flightCargoProcessing) return;

        const baseDate = dayjs().startOf('day');

        const deliveryTime = baseDate
            .hour(dayjs(this.currentDeliverByTime).hour())
            .minute(dayjs(this.currentDeliverByTime).minute());

        const cargoOpeningTime = baseDate
            .hour(dayjs(this.flightCargoProcessing.cargoOpeningTime).hour())
            .minute(dayjs(this.flightCargoProcessing.cargoOpeningTime).minute());

        const cargoClosingTime = baseDate
            .hour(dayjs(this.flightCargoProcessing.cargoClosingTime).hour())
            .minute(dayjs(this.flightCargoProcessing.cargoClosingTime).minute());

        const arrivalTime = baseDate
            .hour(dayjs(this.flightCargoProcessing.arrivalWithProcessingTime).hour())
            .minute(dayjs(this.flightCargoProcessing.arrivalWithProcessingTime).minute());

        this.isDeliveryByTimeBad = deliveryTime.isBefore(arrivalTime)
            && deliveryTime.isAfter(cargoOpeningTime)
            && deliveryTime.isBefore(cargoClosingTime);
    }
    
    confirm(): void {
        const response: FlightAgentConfirmationDialogResult = {
            awb: this.awb,
            shouldAssignToStopJobs: this.assignToStopJobs,
            overrideDeliverByTime: this.overrideDeliverByTime
        };

        this.$mdDialog.hide(response);
    }

    cancel(): void {
        this.$mdDialog.cancel();
    }
}

export default FlightAgentConformationDialogController;
