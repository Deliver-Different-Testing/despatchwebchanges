import {CreateJobDialogController} from "./create-job-dialog.controller";

class CreateJobDialogService implements angular.IServiceProvider {
    static $inject = [
        '$mdDialog',
        '$log',
        '$document'
    ];

    constructor(
        private $mdDialog: angular.material.IDialogService,
        private $log: angular.ILogService,
        private $document: angular.IDocumentService,
    ) {
        this.$log.debug('CreateJobDialogService: Service instantiated');
    }

    $get() {
        return this;
    }

    async showCreateJobDialog($event: MouseEvent) {
        const newJobId: number = await this.$mdDialog.show({
            controller: CreateJobDialogController,
            controllerAs: 'ctrl',
            template: require("./create-job-dialog.template.html"),
            parent: this.$document.parent(),
            targetEvent: $event,
            clickOutsideToClose: false,
            fullscreen: true,
            bindToController: true
        });

        return newJobId;
    }
}

export default CreateJobDialogService;