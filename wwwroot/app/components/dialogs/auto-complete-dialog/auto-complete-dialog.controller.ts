import DispatchCoreService from "../../../services/dispatch-core.service";
import ToastrService from "../../../services/toastr.service";
import {ISuggestion} from "../../../interfaces/job.interface";
import BaseController from "../../base-controller";

export class AutoCompleteDialogController extends BaseController {
    static $inject = [
        "$mdDialog",
        "DispatchData",
        "toastrService",
        "fieldName",
        "title",
        "options",
        "existingItem",
        "showRerateOption"
    ];

    searchText?: string;

    constructor(
        private $mdDialog: angular.material.IDialogService,
        private dispatchData: DispatchCoreService,
        private toastrService: ToastrService,
        public fieldName: string,
        public title: string,
        private options: any,
        public selectedItem: ISuggestion | undefined,
        public showRerateOption: boolean
    ) {
        super();
        console.log('AutoCompleteDialogController: Controller instantiated');
    }
    
    $onInit(): void {
        this.registerTimeout(() => {
            const inputField = angular.element('input[name="autocompleteInput"]');
            if (inputField.length > 0) {
                const element = inputField[0] as HTMLInputElement;
                element.focus();
                element.select();
            }
        });
    }

    async querySearch(searchTerm: string): Promise<ISuggestion[] | undefined> {
        try {
            const url: string = this.options.searchUrl;
            return await this.dispatchData.autocompleteSearch(searchTerm, url);
        } catch (error) {
            this.toastrService.showErrorToast("An error occurred while searching. Please try again later.");
        }
    }

    async submit(selectedOption: ISuggestion): Promise<void> {
            this.$mdDialog.hide(selectedOption);
        }

    cancel(): void {
        this.$mdDialog.cancel();
    }
}
