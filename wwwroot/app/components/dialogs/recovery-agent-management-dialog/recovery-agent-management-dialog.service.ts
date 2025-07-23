import NationwideService from "../../Nationwide/nationwide.service";
import {RecoveryAgentJobViewModel} from "./recovery-agent-management-dialog.interfaces";
import RecoveryAgentManagementController from "./recovery-agent-management-dialog.controller";

class RecoveryAgentManagementService implements angular.IServiceProvider {
    static $inject = [
        '$mdDialog',
        "$document",
        "NationwideService",
    ];

    constructor(
        private $mdDialog: angular.material.IDialogService,
        private $document: angular.IDocumentService,
        private NationwideService: NationwideService,
    ) {
        console.log('RecoveryAgentManagementService: Service instantiated');
    }

    $get() {
        return this;
    }

    async openRecoveryAgentManagementDialog($event: MouseEvent, jobId: number): Promise<RecoveryAgentJobViewModel> {
        const job: RecoveryAgentJobViewModel = await this.NationwideService.getAgentRecoveryJobs(jobId);

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