import {IFlightViewModel} from "../../Nationwide/nationwide.interfaces";
import {IDispatchJob, Suggestion} from "../../../interfaces/job.interface";
import FlightAgentConformationDialogController from "./flight-agent-conformation-dialog.controller";
import {FlightAgentConfirmationDialogResult} from "../../../interfaces/dialog-result.interfaces";
import {bindAllMethods} from "../../../functions/bindAllMethods";

class FlightAgentConfirmationDialogService implements angular.IServiceProvider {
    static $inject = [
        '$mdDialog',
        '$document'
    ];

    dialogResult: FlightAgentConfirmationDialogResult;

    constructor(
        private $mdDialog: angular.material.IDialogService,
        private $document: angular.IDocumentService,
    ) {
        console.log('FlightAgentConfirmationDialogService: Service instantiated');
        bindAllMethods(this);

        this.dialogResult = {
            shouldAssign: false
        }
    }

    $get() {
        return this;
    }

    async flightConfirmationDialog($event: MouseEvent, job: IDispatchJob, flight: IFlightViewModel) {
        const dialogConfig: angular.material.IDialogOptions = {
            controller: FlightAgentConformationDialogController,
            controllerAs: 'ctrl',
            templateUrl: 'app/components/dialogs/flight-agent-conformation-dialog/flight-agent-confirmation-dialog.template.html',
            parent: this.$document.parent(),
            targetEvent: $event,
            clickOutsideToClose: false,
            locals: {
                jobNumber: job.jobNo,
                flight: flight,
                agent: null,
                existingAwb: job.conNote
            }
        };

        try {
            const awb: string = await this.$mdDialog.show(dialogConfig);

            this.dialogResult.shouldAssign = true;
            this.dialogResult.awb = awb;

            return this.dialogResult;
        } catch (error) {
            console.log('Dialog was cancelled or encountered an error', error);
            return this.dialogResult;
        }
    }

    async agentConfirmationDialog($event: MouseEvent, job: IDispatchJob, agent: Suggestion) {
        const dialogConfig: angular.material.IDialogOptions = {
            controller: FlightAgentConformationDialogController,
            controllerAs: 'ctrl',
            templateUrl: 'app/components/dialogs/flight-agent-conformation-dialog/flight-agent-confirmation-dialog.template.html',
            parent: this.$document.parent(),
            targetEvent: $event,
            clickOutsideToClose: false,
            locals: {
                jobNumber: job.jobNo,
                flight: null,
                agent: agent,
                existingAwb: job.conNote
            }
        };

        try {
            const awb: string = await this.$mdDialog.show(dialogConfig);

            this.dialogResult.shouldAssign = true;
            this.dialogResult.awb = awb;

            return this.dialogResult;
        } catch (error) {
            console.log('Dialog was cancelled or encountered an error', error);
            return this.dialogResult;
        }
    }
}

export default FlightAgentConfirmationDialogService;
