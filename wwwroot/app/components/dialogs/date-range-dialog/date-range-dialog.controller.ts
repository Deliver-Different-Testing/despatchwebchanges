import "./date-range-dialog.styles.less";
import BaseController from "../../base-controller";

export class DateRangeDialogController extends BaseController {
    static $inject = ["$mdDialog", "dateRange"];

    private readonly startDate: Date;
    private readonly endDate: Date;

    constructor(
        private $mdDialog: angular.material.IDialogService,
        dateRange: { start?: Date; end?: Date }) {
        super();

        this.startDate = dateRange?.start || new Date();
        this.endDate = dateRange?.end || new Date();
    }

    save(): void {
        this.$mdDialog.hide({
            start: this.startDate, end: this.endDate
        });
    }

    cancel(): void {
        this.$mdDialog.cancel();
    }

    isValidRange(): boolean {
        return this.startDate && this.endDate && this.endDate >= this.startDate;
    }

    getDuration(): number {
        if (!this.startDate || !this.endDate) return 0;
        const diffTime = Math.abs(this.endDate.getTime() - this.startDate.getTime());
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end dates
    }
}
