import {CreateJobDialogController} from "./create-job-dialog.controller";
import angular from 'angular';

class CreateJobDialogService implements angular.IServiceProvider {
    static $inject = [
        '$mdDialog',
        '$document'
    ];

    constructor(
        private $mdDialog: angular.material.IDialogService,
        private $document: angular.IDocumentService,
    ) {
        console.debug('CreateJobDialogService: Service instantiated');
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