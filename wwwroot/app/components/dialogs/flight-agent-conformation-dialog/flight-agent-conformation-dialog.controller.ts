import BaseController from "../../base-controller";
import {IFlightViewModel} from "../../Nationwide/nationwide.interfaces";
import {IAgent, IJob, Suggestion} from "../../../interfaces/job.interface";

class FlightAgentConformationDialogController extends BaseController {
    static $inject = [
        '$mdDialog',
        'jobNumber',
        'flight',
        'agent',
        'existingAwb'
    ];

    isAwbDisabled: boolean = false;
    awb: string = '';
    dialogTitle: string;

    constructor(
        private $mdDialog: angular.material.IDialogService,
        public jobNumber: string,
        public flight?: IFlightViewModel,
        public agent?: Suggestion,
        existingAwb?: string
    ) {
        super();

        this.dialogTitle = flight ? 'Assign Flight' : 'Assign Agent';

        if (existingAwb) {
            this.awb = existingAwb;
            this.isAwbDisabled = true;
        }
    }

    confirm(): void {
        this.$mdDialog.hide(this.awb);
    }

    cancel(): void {
        this.$mdDialog.cancel();
    }
}

export default FlightAgentConformationDialogController;
