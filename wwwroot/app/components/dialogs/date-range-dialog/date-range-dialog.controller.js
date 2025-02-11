import "./date-range-dialog.styles.less";

class DateRangeDialogController {
    static $inject = ["$mdDialog", "dateRange",];

    constructor($mdDialog, dateRange) {
        this.$mdDialog = $mdDialog;

        // Initialize with existing date range if provided
        this.startDate = dateRange?.start || new Date();
        this.endDate = dateRange?.end || new Date();
    }

    /**
     * Save date range and close dialog
     */
    save() {
        this.$mdDialog.hide({
            start: this.startDate, end: this.endDate
        });
    }

    /**
     * Cancel and close dialog
     */
    cancel() {
        this.$mdDialog.cancel();
    }

    /**
     * Validate if end date is after start date
     */
    isValidRange() {
        return this.startDate && this.endDate && this.endDate >= this.startDate;
    }

    /**
     * Calculate duration between start and end dates
     * @returns {number} Number of days between dates
     */
    getDuration() {
        if (!this.startDate || !this.endDate) return 0;
        const diffTime = Math.abs(this.endDate - this.startDate);
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end dates
    }
}

angular.module("uDispatch").controller("DateRangeDialogController", DateRangeDialogController);
