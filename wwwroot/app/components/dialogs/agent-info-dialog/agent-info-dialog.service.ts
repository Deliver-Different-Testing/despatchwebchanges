import {bindAllMethods} from "../../../functions/bindAllMethods";
import AgentInfoDialogController from "./agent-info-dialog.controller";
import NationwideService from "../../Nationwide/nationwide.service";

class AgentInfoDialogService implements angular.IServiceProvider {
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
        console.log('AgentInfoDialogService: Service instantiated');
        bindAllMethods(this);
    }

    $get() {
        return this;
    }

    async openAgentInfoDialog($event: MouseEvent, agentId: number) {
        const agent = await this.nationwideService.getAgentInfoForDialog(agentId);

        await this.$mdDialog
            .show({
                controller: AgentInfoDialogController,
                controllerAs: "ctrl",
                template: require("./agent-info-dialog.template.html"),
                parent: this.$document.parent(),
                clickOutsideToClose: true,
                fullscreen: true,
                targetEvent: $event,
                locals: {
                    agent
                },
                bindToController: true,
            });
    }
}

export default AgentInfoDialogService;
