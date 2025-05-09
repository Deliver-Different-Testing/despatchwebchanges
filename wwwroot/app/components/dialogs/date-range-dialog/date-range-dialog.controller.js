"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DateRangeDialogController = void 0;
require("./date-range-dialog.styles.less");
class DateRangeDialogController {
    constructor($mdDialog, dateRange) {
        this.$mdDialog = $mdDialog;
        // Initialize with existing date range if provided
        this.startDate = (dateRange === null || dateRange === void 0 ? void 0 : dateRange.start) || new Date();
        this.endDate = (dateRange === null || dateRange === void 0 ? void 0 : dateRange.end) || new Date();
    }
    save() {
        this.$mdDialog.hide({
            start: this.startDate, end: this.endDate
        });
    }
    cancel() {
        this.$mdDialog.cancel();
    }
    isValidRange() {
        return this.startDate && this.endDate && this.endDate >= this.startDate;
    }
    getDuration() {
        if (!this.startDate || !this.endDate)
            return 0;
        const diffTime = Math.abs(this.endDate.getTime() - this.startDate.getTime());
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end dates
    }
}
exports.DateRangeDialogController = DateRangeDialogController;
DateRangeDialogController.$inject = ["$mdDialog", "dateRange"];
