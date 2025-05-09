"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SelectDialogController = void 0;
class SelectDialogController {
    constructor($mdDialog, toastrService, id, fieldName, title, options, initialValue, showCheckbox, checkboxLabel) {
        this.$mdDialog = $mdDialog;
        this.toastrService = toastrService;
        this.id = id;
        this.fieldName = fieldName;
        this.title = title;
        this.options = options;
        this.initialValue = initialValue;
        this.showCheckbox = showCheckbox;
        this.checkboxLabel = checkboxLabel;
        this.isLoading = false;
        this.selectedOption = null;
        // Warning message
        this.warningMessage = fieldName === "Status" ?
            "Warning: You are about to change the status of a job. Different statuses trigger different notifications and automated workflows. " +
                "While this change can be reversed, it may impact multiple systems and stakeholders. Please ensure you're selecting the correct status."
            : "";
        this.checkboxValue = false;
        if (initialValue) {
            this.selectedOption = this.findInitialValue(options, initialValue);
        }
    }
    findInitialValue(options, initialValue) {
        var _a;
        return (_a = options.items.find((option) => option.text === initialValue || option.id === initialValue)) !== null && _a !== void 0 ? _a : null;
    }
    submit(selectedOption) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                this.isLoading = true;
                const result = {
                    fieldName: this.fieldName,
                    value: selectedOption.id,
                    checkboxValue: this.showCheckbox ? this.checkboxValue : undefined
                };
                this.$mdDialog.hide(result);
            }
            catch (error) {
                this.toastrService.showErrorToast(error.message);
            }
            finally {
                this.isLoading = false;
            }
        });
    }
    cancel() {
        this.$mdDialog.cancel();
    }
}
exports.SelectDialogController = SelectDialogController;
SelectDialogController.$inject = ["$mdDialog", "toastrService", "id", "fieldName", "title", "options", "initialValue", "showCheckbox", "checkboxLabel"];
