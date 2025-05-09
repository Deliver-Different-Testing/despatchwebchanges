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
exports.SelectDialogService = void 0;
class SelectDialogService {
    constructor($mdDialog) {
        this.$mdDialog = $mdDialog;
        console.log('SelectDialogService: Service instantiated');
    }
    $get() {
        return this;
    }
    showSelectDialog($event, data, fieldName, title, initialValue = null, showCheckbox = false, checkboxLabel = "") {
        return __awaiter(this, void 0, void 0, function* () {
            const options = {
                minimumInputLength: 1, items: data, placeholder: title
            };
            const result = yield this.$mdDialog.show({
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
        });
    }
}
exports.SelectDialogService = SelectDialogService;
SelectDialogService.$inject = [
    '$mdDialog'
];
