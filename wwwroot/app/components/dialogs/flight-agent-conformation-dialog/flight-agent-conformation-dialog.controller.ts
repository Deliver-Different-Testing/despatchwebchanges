import "./flight-agent-confirmation-dialog.layout.less";
import BaseController from "../../base-controller";
import {IFlightViewModel} from "../../Nationwide/nationwide.interfaces";
import {Suggestion} from "../../../interfaces/job.interface";
import getDangerousGoodsClassName from "../../../functions/getDangerousGoodsClassName";

class FlightAgentConformationDialogController extends BaseController {
    static $inject = [
        '$mdDialog',
        'jobNumber',
        'flight',
        'agent',
        'existingAwb',
        'dgClass'
    ];

    isAwbDisabled: boolean = false;
    awb: string = '';
    dialogTitle: string;
    dgClassName?: string;

    constructor(
        private $mdDialog: angular.material.IDialogService,
        public jobNumber: string,
        public flight?: IFlightViewModel,
        public agent?: Suggestion,
        existingAwb?: string,
        dgClass?: number,
    ) {
        super();

        this.dialogTitle = flight ? 'Assign Flight' : 'Assign Agent';

        if(dgClass !== undefined){
            this.dgClassName = getDangerousGoodsClassName(dgClass);
        }

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
