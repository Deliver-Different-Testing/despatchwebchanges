import {ISuggestion} from "../../../interfaces/job.interface";
import {ISelectDialogResult} from "../../../interfaces/dialog-result.interfaces";
import {SelectDialogController} from "./select-dialog.controller";

export class SelectDialogService implements angular.IServiceProvider {
    static $inject = [
        '$mdDialog',
        '$document'
    ];

    constructor(
        private $mdDialog: angular.material.IDialogService,
        private $document: angular.IDocumentService,
    ) {
        console.log('SelectDialogService: Service instantiated');
    }

    $get(): any {
        return this;
    }

    async showSelectDialog($event: MouseEvent, data: ISuggestion[],
                           fieldName: string, title: string, initialValue: string | null | number = null,
                           showCheckbox: boolean = false, checkboxLabel: string = "") {
        const options = {
            minimumInputLength: 1, items: data, placeholder: title
        };

        const result: ISelectDialogResult = await this.$mdDialog.show({
            controller: SelectDialogController,
            controllerAs: "ctrl",
            parent: this.$document.parent(),
            targetEvent: $event,
            template: require("./select-dialog.template.html"),
            clickOutsideToClose: true,
            fullscreen: false,
            locals: {
                id: 'editField', fieldName, title, options, initialValue, showCheckbox, checkboxLabel
            },
            bindToController: true
        });

        return result;
    }
}
