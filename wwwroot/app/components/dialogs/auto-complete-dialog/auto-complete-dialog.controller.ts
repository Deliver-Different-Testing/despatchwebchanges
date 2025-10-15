import "./auto-complete-dialog.styles.less";
import DispatchCoreService from "../../../services/dispatch-core.service";
import ToastrService from "../../../services/toastr.service";
import {ISuggestion} from "../../../interfaces/job.interface";
import BaseController from "../../base-controller";
import IAutoCompleteOptions from "./interfaces/IAutoCompleteOptions";

export class AutoCompleteDialogController extends BaseController {
    static $inject = [
        "$mdDialog",
        "DispatchData",
        "toastrService",
        "$interval",
        "$timeout",
        "fieldName",
        "title",
        "options",
        "existingItem",
        "showRerateOption"
    ];

    searchText?: string;
    showRerateOption: boolean;
    selectedItem?: ISuggestion;
    itemIcon: string;

    constructor(
        private $mdDialog: angular.material.IDialogService,
        private dispatchData: DispatchCoreService,
        private toastrService: ToastrService,
        $interval: angular.IIntervalService,
        $timeout: angular.ITimeoutService,
        public fieldName: string,
        public title: string,
        private options: IAutoCompleteOptions,
        selectedItem: ISuggestion | undefined,
        showRerateOption: boolean,
        itemIcon: string
    ) {
        super();
        this.initServices($timeout, $interval);

        this.selectedItem = selectedItem;
        this.showRerateOption = showRerateOption;
        this.itemIcon = itemIcon;
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
