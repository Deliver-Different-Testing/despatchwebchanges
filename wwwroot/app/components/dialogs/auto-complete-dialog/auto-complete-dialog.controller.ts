import DispatchCoreService from "../../../services/dispatch-core.service";
import ToastrService from "../../../services/toastr.service";
import {Suggestion} from "../../../interfaces/job.interface";
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

    searchText: string = '"';

    constructor(
        private $mdDialog: angular.material.IDialogService,
        private dispatchData: DispatchCoreService,
        private toastrService: ToastrService,
        public fieldName: string,
        public title: string,
        private options: any,
        public selectedItem: Suggestion | undefined,
        public showRerateOption: boolean
    ) {
        super();
        console.log('AutoCompleteDialogController: Controller instantiated');
    }

    async querySearch(searchTerm: string): Promise<Suggestion[] | undefined> {
        try {
            const url: string = this.options.searchUrl;
            return await this.dispatchData.autocompleteSearch(searchTerm, url);
        } catch (error: any) {
            this.toastrService.showErrorToast(error.message);
        }
    }

    async submit(selectedOption: Suggestion): Promise<void> {
            this.$mdDialog.hide(selectedOption);
        }

    cancel(): void {
        this.$mdDialog.cancel();
    }
}
