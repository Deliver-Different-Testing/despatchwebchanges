import {IFlightViewModel} from "../../Nationwide/nationwide.interfaces";
import {IDispatchJob, ISuggestion} from "../../../interfaces/job.interface";
import FlightAgentConformationDialogController from "./flight-agent-conformation-dialog.controller";
import {FlightAgentConfirmationDialogResult} from "../../../interfaces/dialog-result.interfaces";
import countSubJobs from "../../../functions/countSubJobs";
import IFlightAgentConfirmationDialogLocals from "./interfaces/IFlightAgentConfirmationDialogLocals";

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
        console.debug('FlightAgentConfirmationDialogService: Service instantiated');

        this.dialogResult = {
            shouldAssign: false
        }
    }

    $get() {
        return this;
    }

    private async showConfirmationDialog($event: MouseEvent, dialogLocals: IFlightAgentConfirmationDialogLocals) {
        const dialogConfig: angular.material.IDialogOptions = {
            controller: FlightAgentConformationDialogController,
            controllerAs: 'ctrl',
            template: require("./flight-agent-confirmation-dialog.template.html"),
            parent: this.$document.parent(),
            targetEvent: $event,
            clickOutsideToClose: false,
            locals: dialogLocals,
            bindToController: true,
            fullscreen: true,
        };

        try {
            this.dialogResult = await this.$mdDialog.show(dialogConfig);
            this.dialogResult.shouldAssign = true;
            return this.dialogResult;
        } catch (error) {
            if (error) {
                console.debug('Dialog was cancelled or encountered an error:', error);
            } else {
                console.debug('Dialog was dismissed by user');
            }

            this.dialogResult.shouldAssign = false;
            this.dialogResult.awb = undefined;
            return this.dialogResult;
        }
    }

    async flightConfirmationDialog($event: MouseEvent, job: IDispatchJob, flight: IFlightViewModel) {
        return this.showConfirmationDialog($event, {
            jobId: job.id,
            jobNumber: job.jobNo,
            flight: flight,
            agent: undefined,
            existingAwb: job.conNote,
            dgClass: job.dgClass,
            stopJobCount: undefined
        });
    }

    async agentConfirmationDialog($event: MouseEvent, job: IDispatchJob, agent: ISuggestion) {
      const stopJobCount = job.relatedJobs ? countSubJobs(job.jobNo, job.relatedJobs) : 0;

        return this.showConfirmationDialog($event, {
            jobId: job.id,
            jobNumber: job.jobNo,
            flight: undefined,
            agent: agent,
            existingAwb: job.conNote,
            dgClass: job.dgClass,
            stopJobCount
        });
    }
}

export default FlightAgentConfirmationDialogService;
