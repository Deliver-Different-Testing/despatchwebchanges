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
exports.EditDateTimeDialogController = void 0;
require("./edit-date-time-dialog.less");
class EditDateTimeDialogController {
    constructor($mdDialog, toastrService, moment, title, fieldName, dateTime, showDate, showTime) {
        this.$mdDialog = $mdDialog;
        this.toastrService = toastrService;
        this.moment = moment;
        this.title = title;
        this.fieldName = fieldName;
        this.showDate = showDate;
        this.showTime = showTime;
        this._initializeDateTime(dateTime);
        this.isLoading = false;
        this.message = {
            hour: "Hour is required",
            minute: "Minute is required",
        };
    }
    _initializeDateTime(dateTime) {
        let parsedDate;
        if (dateTime === null || dateTime === undefined || isNaN(new Date(dateTime).getTime())) {
            console.warn("Invalid or null date provided. Using current date/time.");
            parsedDate = new Date();
        }
        else {
            parsedDate = new Date(dateTime);
        }
        if (this.showDate) {
            this.date = new Date(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate());
        }
        if (this.showTime) {
            this.time = new Date(1970, 0, 1, parsedDate.getHours(), parsedDate.getMinutes());
        }
    }
    isValid() {
        if (this.showDate && this.showTime) {
            return this.date !== null && this.time !== null;
        }
        else if (this.showDate) {
            return this.date !== null;
        }
        else if (this.showTime) {
            return this.time !== null;
        }
        // If made it this far, something went wrong
        return false;
    }
    submit() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                this.isLoading = true;
                const newDateTime = this._combineDateTime();
                if (newDateTime === null)
                    return;
                const formattedDateTime = this._formatDateTime(newDateTime);
                if (formattedDateTime === null)
                    return;
                // Create result object
                const result = {
                    fieldName: this.fieldName,
                    value: formattedDateTime,
                    formattedDateTime: formattedDateTime
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
    _combineDateTime() {
        if (this.showDate && this.showTime) {
            const combinedDate = new Date(this.date);
            combinedDate.setHours(this.time.getHours(), this.time.getMinutes());
            return combinedDate;
        }
        else if (this.showDate) {
            return this.date || null;
        }
        else if (this.showTime) {
            return this.time || null;
        }
        return null;
    }
    _formatDateTime(dateTime) {
        // Ensure valid date
        if (isNaN(dateTime.getTime())) {
            console.warn("Invalid date provided to formatDateTime");
            return null;
        }
        return this.moment(dateTime).format("YYYY-MM-DDTHH:mm");
    }
    cancel() {
        this.$mdDialog.cancel();
    }
}
exports.EditDateTimeDialogController = EditDateTimeDialogController;
EditDateTimeDialogController.$inject = [
    "$mdDialog",
    "toastrService",
    "moment",
    "title",
    "fieldName",
    "dateTime",
    "showDate",
    "showTime",
];
