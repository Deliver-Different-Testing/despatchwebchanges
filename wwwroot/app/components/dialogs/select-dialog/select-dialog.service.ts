import {Suggestion} from "../../../interfaces/job.interface";
import app from "../../../app";
import {ISelectDialogResult} from "../../../interfaces/dialog-result.interfaces";

export class SelectDialogService implements angular.IServiceProvider {
    static $inject = [
        '$mdDialog'
    ];

    constructor(
        private $mdDialog: angular.material.IDialogService
    ) {
        console.log('SelectDialogService: Service instantiated');
    }

    $get(): any {
        return this;
    }

    async showSelectDialog($event: MouseEvent, data: Suggestion[],
                           fieldName: string, title: string, initialValue: string | null | number = null,
                           showCheckbox: boolean = false, checkboxLabel: string = "") {
        const options = {
            minimumInputLength: 1, items: data, placeholder: title
        };

        const result: ISelectDialogResult = await this.$mdDialog.show({
            controller: "SelectDialogController",
            controllerAs: "ctrl",
            parent: document.body,
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
