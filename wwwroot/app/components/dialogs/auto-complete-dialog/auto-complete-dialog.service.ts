import {AutoCompleteDialogController} from "./auto-complete-dialog.controller";
import {ISuggestion} from "../../../interfaces/job.interface";
import IAutoCompleteOptions from "./interfaces/IAutoCompleteOptions";

class AutoCompleteDialogService implements angular.IServiceProvider {
    static $inject = [
        '$mdDialog',
        '$document'
    ];

    constructor(
        private $mdDialog: angular.material.IDialogService,
        private $document: angular.IDocumentService,
    ) {
        console.debug('AutoCompleteDialogService: Service instantiated');
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
                                 showRerateOption?: boolean,
                                 itemIcon: string = "topic") {
        console.debug('AutoCompleteDialogService: showAutocompleteDialog called');
        
        const options: IAutoCompleteOptions = {
            placeholder, 
            minimumInputLength: 2, 
            searchUrl: url
        };

        const data: ISuggestion = await this.$mdDialog.show({
            controller: AutoCompleteDialogController,
            controllerAs: "ctrl",
            parent: this.$document.parent(),
            targetEvent: $event,
            template: require("./auto-complete-dialog.template.html"),
            clickOutsideToClose: true,
            escapeToClose: true,
            fullscreen: false,
            locals: {
                fieldName,
                title, 
                options,
                existingItem,
                showRerateOption,
                itemIcon
            },
            focusOnOpen: true,
            bindToController: true
        });

        console.debug('AutoCompleteDialogService: showAutocompleteDialog returned');
        
        return data;
    }
}

export default AutoCompleteDialogService;
