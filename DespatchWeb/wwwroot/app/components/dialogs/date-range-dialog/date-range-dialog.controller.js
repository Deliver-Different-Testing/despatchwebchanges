/**
 * @class DateRangeDialogController
 */
class DateRangeDialogController {
    static $inject = ['$mdDia']

    constructor($mdDialog, dateRange) {
        this.$mdDialog = $mdDialog;
        this.dateRange = {
            start: dateRange.start,
            end: dateRange.end
        };
    }

    save() {
        this.$mdDialog.hide(this.dateRange);
    }

    cancel() {
        this.$mdDialog.cancel();
    }
}
