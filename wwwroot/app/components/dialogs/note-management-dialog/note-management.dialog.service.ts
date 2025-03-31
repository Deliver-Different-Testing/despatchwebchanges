import {TucNoteViewModel} from "../../../interfaces/job.interface";
import NoteManagementDialogController from "./note-management-dialog.component";
import {IDocumentService, material} from "angular";

class NoteManagementDialogService {
    static $inject = [
        '$mdDialog',
        '$document'
    ];

    constructor(
        private $mdDialog: material.IDialogService,
        private $document: IDocumentService
    ) {}

    $get() {
        return this;
    }

    async openNoteDialog($event: MouseEvent, model: TucNoteViewModel | null, staffId: number) {
        await this.$mdDialog.show({
            controller: NoteManagementDialogController,
            controllerAs: 'ctrl',
            template: require('./note-management-dialog.template.html'),
            parent: this.$document.parent(),
            targetEvent: $event,
            clickOutsideToClose: false,
            locals: {
                model,
                staffId
            }
        });
    }
}

export default NoteManagementDialogService;
