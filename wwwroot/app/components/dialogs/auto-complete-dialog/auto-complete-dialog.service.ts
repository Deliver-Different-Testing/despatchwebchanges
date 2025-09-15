import {AutoCompleteDialogController} from "./auto-complete-dialog.controller";
import {ISuggestion} from "../../../interfaces/job.interface";
import IAutoCompleteOptions from "./interfaces/IAutoCompleteOptions";

class AutoCompleteDialogService implements angular.IServiceProvider {
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
        this.$log.debug('AutoCompleteDialogService: Service instantiated');
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
        this.$log.debug('AutoCompleteDialogService: showAutocompleteDialog called');
        
        const options: IAutoCompleteOptions = {
            placeholder, 
            minimumInputLength: 3, 
            searchUrl: url
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

        this.$log.debug('AutoCompleteDialogService: showAutocompleteDialog returned');
        
        return data;
    }
}

export default AutoCompleteDialogService;
