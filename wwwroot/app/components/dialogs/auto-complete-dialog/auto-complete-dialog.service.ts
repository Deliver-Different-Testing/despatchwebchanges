import {AutoCompleteDialogController} from "./auto-complete-dialog.controller";
import {ISuggestion} from "../../../interfaces/job.interface";

class AutoCompleteDialogService implements angular.IServiceProvider {
    static $inject = [
        '$mdDialog',
        '$document'
    ];

    constructor(
        private $mdDialog: angular.material.IDialogService,
        private $document: angular.IDocumentService,
    ) {
        console.log('AutoCompleteDialogService: Service instantiated');
    }

    $get() {
        return this;
    }

    async showAutocompleteDialog($event: MouseEvent,
                                 url: string,
                                 placeholder: string,
                                 fieldName: string,
                                 title: string,
                                 existingItem: any,
                                 showRerateOption?: boolean) {
        const options = {
            placeholder, minimumInputLength: 3, searchUrl: url
        };

        const data: ISuggestion = await this.$mdDialog.show({
            controller: AutoCompleteDialogController,
            controllerAs: "ctrl",
            parent: this.$document.parent(),
            targetEvent: $event,
            template: require("./auto-complete-dialog.html"),
            clickOutsideToClose: true,
            fullscreen: false,
            locals: {
                fieldName, title, options, existingItem, showRerateOption
            },
            bindToController: true
        });

        return data;
    }
}

export default AutoCompleteDialogService;
