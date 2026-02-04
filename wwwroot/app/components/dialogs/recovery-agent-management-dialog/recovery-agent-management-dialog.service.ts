import NationwideService from "../../Nationwide/nationwide.service";
import {RecoveryAgentJobViewModel} from "./recovery-agent-management-dialog.interfaces";
import RecoveryAgentManagementController from "./recovery-agent-management-dialog.controller";
import angular from 'angular';

class RecoveryAgentManagementService implements angular.IServiceProvider {
    static $inject = [
        '$mdDialog',
        "$document",
        "NWData",
    ];

    constructor(
        private $mdDialog: angular.material.IDialogService,
        private $document: angular.IDocumentService,
        private nationwideService: NationwideService,
    ) {
        console.log('RecoveryAgentManagementService: Service instantiated');
    }

    $get() {
        return this;
    }

    async openRecoveryAgentManagementDialog($event: MouseEvent, jobId: number): Promise<RecoveryAgentJobViewModel> {
        const job: RecoveryAgentJobViewModel = await this.nationwideService.getAgentRecoveryJobs(jobId);

        return this.$mdDialog
            .show({
                controller: RecoveryAgentManagementController,
                controllerAs: "ctrl",
                template: require("./recovery-agent-management.template.html"),
                parent: this.$document.parent(),
                clickOutsideToClose: false,
                fullscreen: true,
                targetEvent: $event,
                locals: {
                    job
                },
                bindToController: true,
            });
    }
}

export default RecoveryAgentManagementService;