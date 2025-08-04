import "./flight-agent-confirmation-dialog.layout.less";
import BaseController from "../../base-controller";
import {IFlightViewModel} from "../../Nationwide/nationwide.interfaces";
import {Suggestion} from "../../../interfaces/job.interface";
import getDangerousGoodsClassName from "../../../functions/getDangerousGoodsClassName";
import {FlightAgentConfirmationDialogResult} from "../../../interfaces/dialog-result.interfaces";

class FlightAgentConformationDialogController extends BaseController {
    static $inject = [
        '$mdDialog',
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

    constructor(
        private $mdDialog: angular.material.IDialogService,
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

        if(dgClass !== undefined){
            this.dgClassName = getDangerousGoodsClassName(dgClass);
        }

        if (existingAwb) {
            this.awb = existingAwb;
            this.isAwbDisabled = true;
        }
    }

    confirm(): void {
        const response: FlightAgentConfirmationDialogResult = {
            awb: this.awb,
            shouldAssignToStopJobs: this.assignToStopJobs
        };

        this.$mdDialog.hide(response);
    }

    cancel(): void {
        this.$mdDialog.cancel();
    }
}

export default FlightAgentConformationDialogController;
