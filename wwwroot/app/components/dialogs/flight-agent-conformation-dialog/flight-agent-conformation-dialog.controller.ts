import "./flight-agent-confirmation-dialog.layout.less";
import BaseController from "../../base-controller";
import {IFlightViewModel} from "../../Nationwide/nationwide.interfaces";
import {Suggestion} from "../../../interfaces/job.interface";
import getDangerousGoodsClassName from "../../../functions/getDangerousGoodsClassName";
import {FlightAgentConfirmationDialogResult} from "../../../interfaces/dialog-result.interfaces";
import NationwideService from "../../Nationwide/nationwide.service";

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
    flightArrivalTimeWithProcessing?: Date;
    isDeliveryByTimeBad: boolean = false;

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
            this.getEnabledAlertEvents()
                .then(() => this.getDeliverByTime())
                .then(() => this.calculateFlightArrivalTimeForAirport())
                .catch(error => {
                    console.error('Error during initialization:', error);
                });

            if (!this.currentDeliverByTime) this.overrideDeliverByTime = true;
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
            if (this.currentDeliverByTime) this.checkDeliverTimeAcceptable();
        } catch (error) {
            console.error('Failed to load delivery by time:', error);
            this.currentDeliverByTime = undefined;
        } finally {
            this.applyScope();
        }
    }

    async calculateFlightArrivalTimeForAirport(): Promise<void> {
        if (!this.flight?.arrivalTime || !this.toAirportId) return;

        try {
            this.flightArrivalTimeWithProcessing = await this.nationwideService.calculateArrivalTimeForAirport(this.toAirportId, this.flight?.arrivalTime);
        } catch (error) {
            console.error('Failed to calculate flight arrival time:', error);
        } finally {
            this.applyScope();
        }
    }

    checkDeliverTimeAcceptable(): void {
        if (!this.currentDeliverByTime || !this.flightArrivalTimeWithProcessing) return;
        this.isDeliveryByTimeBad = this.currentDeliverByTime < this.flightArrivalTimeWithProcessing;
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
