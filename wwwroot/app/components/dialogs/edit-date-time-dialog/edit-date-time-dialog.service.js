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
exports.EditDateTimeDialogService = void 0;
class EditDateTimeDialogService {
    constructor($mdDialog) {
        this.$mdDialog = $mdDialog;
        console.log('EditDateTimeDialogService: Service instantiated');
    }
    $get() {
        return this;
    }
    _getBaseDialogConfig($event, title, fieldName, dateTime) {
        return {
            controller: "EditDateTimeDialogController",
            controllerAs: "ctrl",
            parent: document.body,
            targetEvent: $event,
            template: require("./edit-date-time-dialog.template.html"),
            clickOutsideToClose: true,
            fullscreen: true,
            bindToController: true,
            locals: {
                title,
                fieldName,
                dateTime
            }
        };
    }
    showEditTimeDialog($event, title, fieldName, dateTime) {
        return __awaiter(this, void 0, void 0, function* () {
            const config = Object.assign(Object.assign({}, this._getBaseDialogConfig($event, title, fieldName, dateTime)), { locals: Object.assign(Object.assign({}, this._getBaseDialogConfig($event, title, fieldName, dateTime).locals), { showDate: false, showTime: true }) });
            const result = yield this.$mdDialog.show(config);
            return result;
        });
    }
    showEditDateDialog($event, title, fieldName, dateTime) {
        return __awaiter(this, void 0, void 0, function* () {
            const config = Object.assign(Object.assign({}, this._getBaseDialogConfig($event, title, fieldName, dateTime)), { locals: Object.assign(Object.assign({}, this._getBaseDialogConfig($event, title, fieldName, dateTime).locals), { showDate: true, showTime: false }) });
            const result = yield this.$mdDialog.show(config);
            return result;
        });
    }
    showEditDateAndTimeDialog($event, title, fieldName, dateTime) {
        return __awaiter(this, void 0, void 0, function* () {
            const config = Object.assign(Object.assign({}, this._getBaseDialogConfig($event, title, fieldName, dateTime)), { locals: Object.assign(Object.assign({}, this._getBaseDialogConfig($event, title, fieldName, dateTime).locals), { showDate: true, showTime: true }) });
            const result = yield this.$mdDialog.show(config);
            return result;
        });
    }
}
exports.EditDateTimeDialogService = EditDateTimeDialogService;
EditDateTimeDialogService.$inject = ['$mdDialog'];
