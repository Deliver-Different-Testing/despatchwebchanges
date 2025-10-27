import {IJobNote} from "../../../interfaces/job.interface";
import NoteManagementDialogController from "./note-management-dialog.component";
import {IDocumentService, material} from "angular";

class NoteManagementDialogService implements angular.IServiceProvider {
    static $inject = [
        '$mdDialog',
        '$document'
    ];

    constructor(
        private $mdDialog: material.IDialogService,
        private $document: IDocumentService
    ) {
        console.log('NoteManagementDialogService: Service instantiated');
    }

    $get() {
        return this;
    }

    async openNoteDialog($event: MouseEvent, model: IJobNote | null,) {
        await this.$mdDialog.show({
            controller: NoteManagementDialogController,
            controllerAs: 'ctrl',
            template: require('./note-management-dialog.template.html'),
            parent: this.$document.parent(),
            targetEvent: $event,
            clickOutsideToClose: false,
            locals: {
                model
            },
            bindToController: true,
            fullscreen: true,
        });
    }
}

export default NoteManagementDialogService;
