import ToastrService from "../../../services/toastr.service";
import {Suggestion} from "../../../interfaces/job.interface";
import {ISelectDialogResult} from "../../../interfaces/dialog-result.interfaces";
import {JobProperty} from "../../../enums/job-property.enum";
import BaseController from "../../base-controller";

export class SelectDialogController extends BaseController {
    static $inject = ["$mdDialog", "toastrService", "id", "fieldName", "title", "options", "initialValue", "showCheckbox", "checkboxLabel"];

    isLoading: boolean;
    selectedOption: any;
    warningMessage: string;
    checkboxValue: boolean;

    constructor(
        private $mdDialog: angular.material.IDialogService,
        private toastrService: ToastrService,
        public id: number,
        public fieldName: string,
        public title: string,
        public options: any,
        public initialValue: string | number | null,
        public showCheckbox: boolean,
        public checkboxLabel: string
    ) {
        super();

        this.isLoading = false;
        this.selectedOption = null;

        // Warning message
        this.warningMessage = fieldName === JobProperty.Status ?
            "Warning: You are about to change the status of a job. Different statuses trigger different notifications and automated workflows. " +
            "While this change can be reversed, it may impact multiple systems and stakeholders. Please ensure you're selecting the correct status."
            : "";
        this.checkboxValue = false;

        if (initialValue) {
            this.selectedOption = this.findInitialValue(options, initialValue);
        }
    }

    private findInitialValue(options: any, initialValue: string | number): any | null {
        return options.items.find((option: any) =>
            option.text === initialValue || option.id === initialValue
        ) ?? null;
    }

    async submit(selectedOption: Suggestion): Promise<void> {
        try {
            this.isLoading = true;

            const result: ISelectDialogResult = {
                fieldName: this.fieldName,
                value: selectedOption.id,
                checkboxValue: this.showCheckbox ? this.checkboxValue : undefined
            };

            this.$mdDialog.hide(result);
        } catch (error: any) {
            this.toastrService.showErrorToast(error.message);
        } finally {
            this.isLoading = false;
        }
    }

    cancel(): void {
        this.$mdDialog.cancel();
    }
}
