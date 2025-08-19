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

    constructor(
        private $mdDialog: angular.material.IDialogService,
        private nationwideService: NationwideService,
        private jobId: number,
        public jobNumber: string,
        public flight?: IFlightViewModel,
        public agent?: Suggestion,
        existingAwb?: string,
        dgClass?: number,
        stopJobCount?: number,
    ) {
        super();

        this.dialogTitle = flight ? 'Assign Flight' : 'Assign Agent';
        this.showIncludeStopJobs = (stopJobCount !== undefined && stopJobCount > 0);

        if (flight) {
            this.getEnabledAlertEvents();
            this.getDeliverByTime();
            
            // Override if null
            if(!this.currentDeliverByTime) {
                this.overrideDeliverByTime = true;
            }
        }

        if (dgClass !== undefined) {
            this.dgClassName = getDangerousGoodsClassName(dgClass);
        }

        if (existingAwb) {
            this.awb = existingAwb;
            this.isAwbDisabled = true;
        }
    }

    getEnabledAlertEvents() {
        this.loadingAlerts = true;
        this.nationwideService.getEnabledWebhookEvents()
            .then(alert => {
                this.enabledAlerts = alert;
            })
            .catch(error => {
                console.error('Failed to load webhook alerts:', error);
                this.enabledAlerts = [];
            })
            .finally(() => {
                this.loadingAlerts = false;
            });
    }

    getDeliverByTime() {
        this.nationwideService.getDeliveryByTimeForJob(this.jobId).then(deliverByTime => {
            this.currentDeliverByTime = deliverByTime;
        }).catch(error => {
            console.error('Failed to load delivery by time:', error);
            this.currentDeliverByTime = undefined;
        });
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
