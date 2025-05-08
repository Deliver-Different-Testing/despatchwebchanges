import "./edit-date-time-dialog.less";
import ToastrService from "../../../services/toastr.service";
import {IDialogDateTimeResult} from "../../../interfaces/dialog-result.interfaces";
import moment from "moment";
import "moment-timezone";
import DispatchCoreService from "../../../services/dispatch-core.service";
import {Suggestion, TimeZoneSuggestion} from "../../../interfaces/job.interface";
import BaseController from "../../base-controller";
import {JobProperty} from "../../../enums/job-property.enum";

export class EditDateTimeDialogController extends BaseController {
    static $inject = [
        "$mdDialog",
        "toastrService",
        "DispatchData",
        "title",
        "fieldName",
        "dateTime",
        "defaultTimeZone",
        "showTimeZone",
        "showDate",
        "showTime",
    ];

    momentDateTime: moment.Moment;
    isLoading: boolean;
    browserTimeZone: string;
    selectedTimeZone?: TimeZoneSuggestion;
    timeZones?: TimeZoneSuggestion[];
    showTimeZoneSelector: boolean = false;

    constructor(
        private $mdDialog: angular.material.IDialogService,
        private toastrService: ToastrService,
        private DispatchData: DispatchCoreService,
        public readonly title: string,
        public readonly fieldName: JobProperty,
        public dateTime: Date,
        private defaultTimeZone?: Suggestion,
        private showTimeZone: boolean = false,
        public showDate: boolean = true,
        public showTime: boolean = true,
    ) {
        super();

        this.showTimeZoneSelector = showTimeZone; // Convert to boolean

        // Initialize with current date/time if not provided
        if (!this.dateTime) {
            this.dateTime = new Date();
        }

        // Convert to moment object for easier manipulation
        this.momentDateTime = moment(this.dateTime);

        // Get browser timezone
        this.browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

        // Get a list of time zones if needed
        if (showTimeZone) {
            this.DispatchData.getTimeZoneOptions().then((data: TimeZoneSuggestion[]) => {
                this.timeZones = data;

                if (this.defaultTimeZone) {
                    this.selectedTimeZone = data.find(tz => tz.id === this.defaultTimeZone?.id);
                }
            });
        }

        this.isLoading = false;
    }

    isValid(): boolean {
        // Check if we have a valid moment
        if (!this.momentDateTime || !this.momentDateTime.isValid()) {
            return false;
        }

        // At least one of date or time must be shown
        if (!this.showDate && !this.showTime) {
            return false;
        }

        // If timezone selector is shown, a timezone must be selected
        return !(this.showTimeZoneSelector && !this.selectedTimeZone);
    }

    async submit(): Promise<void> {
        try {
            this.isLoading = true;

            if (!this.momentDateTime.isValid()) {
                throw new Error("Invalid date or time");
            }

            // Create result object
            const result: IDialogDateTimeResult = {
                fieldName: this.fieldName,
                value: this.momentDateTime.toDate(),
                selectedTimeZoneId: this.selectedTimeZone?.id
            };

            this.$mdDialog.hide(result);
        } catch (error: any) {
            this.toastrService.showErrorToast(error.message);
        } finally {
            this.isLoading = false;
        }
    }

    getFormattedDate(): string {
        return this.momentDateTime.format('YYYY-MM-DD');
    }

    getFormattedTime(): string {
        return this.momentDateTime.format('HH:mm');
    }

    updateDateTime(type: 'date' | 'time', value: string): void {
        const currentValue = moment(this.momentDateTime);

        if (type === 'date') {
            const [year, month, day] = value.split('-').map(Number);
            currentValue.year(year).month(month - 1).date(day);
        } else if (type === 'time') {
            const [hours, minutes] = value.split(':').map(Number);
            currentValue.hours(hours).minutes(minutes);
        }

        this.momentDateTime = currentValue;
    }


    updateTimeZone(timezone: TimeZoneSuggestion): void {
        // Just store the selected timezone - no conversion needed
        this.selectedTimeZone = timezone;
    }

    cancel(): void {
        this.$mdDialog.cancel();
    }
}
