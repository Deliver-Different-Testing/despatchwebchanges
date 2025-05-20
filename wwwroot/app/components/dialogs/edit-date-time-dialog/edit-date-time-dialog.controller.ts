import "./edit-date-time-dialog.less";
import ToastrService from "../../../services/toastr.service";
import {IDialogDateTimeResult} from "../../../interfaces/dialog-result.interfaces";
import moment from "moment";
import {Suggestion, TimeZoneSuggestion} from "../../../interfaces/job.interface";
import BaseController from "../../base-controller";
import {JobProperty} from "../../../enums/job-property.enum";
import {findWindows} from "windows-iana";

export class EditDateTimeDialogController extends BaseController {
    static $inject = [
        "$mdDialog",
        "toastrService",
        "title",
        "fieldName",
        "dateTime",
        "showTimeZone",
        "defaultTimeZone",
        "showDate",
        "showTime",
    ];

    momentDateTime!: moment.Moment;
    isLoading?: boolean;
    browserTimeZone?: string;
    selectedTimeZone?: TimeZoneSuggestion;
    timeZone: string;

    constructor(
        private $mdDialog: angular.material.IDialogService,
        private toastrService: ToastrService,
        public readonly title: string,
        public readonly fieldName: JobProperty,
        public dateTime: Date,
        public showTimeZoneSelector: boolean = false,
        private defaultTimeZone?: Suggestion,
        public showDate: boolean = true,
        public showTime: boolean = true,
    ) {
        super();

        this.timeZone = TimeZone;
        console.log('EditDateTimeDialogController: Controller instantiated');
        if (!this.dateTime) {
            this.dateTime = new Date();
        }

        this.momentDateTime = moment(this.dateTime);
        this.browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

        if(this.showTimeZoneSelector && this.defaultTimeZone) {
            this.selectedTimeZone = {
                id: this.defaultTimeZone?.id,
                text: findWindows(this.defaultTimeZone?.text)[0],
                timeZoneIana: this.defaultTimeZone?.text
            }
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

        // If a timezone selector is shown, a timezone must be selected
        return !(this.showTimeZoneSelector && !this.selectedTimeZone);
    }

    async submit(): Promise<void> {
        try {
            this.isLoading = true;

            if (!this.momentDateTime || !this.momentDateTime.isValid()) {
                this.toastrService.showWarningToast("Please select a valid date and time.");
                return;
            }

            console.log('EditDateTimeDialogController: Submitting', this.getFormattedDate(this.momentDateTime));

            // Create result object
            const result: IDialogDateTimeResult = {
                fieldName: this.fieldName,
                value: this.getFormattedDate(this.momentDateTime),
                selectedTimeZoneId: this.selectedTimeZone?.id
            };

            this.$mdDialog.hide(result);
        } catch (error: any) {
            this.toastrService.showErrorToast(error.message);
        } finally {
            this.isLoading = false;
        }
    }

    getFormattedDate(dateTime: moment.Moment): string {
        return dateTime.format('YYYY-MM-DD HH:mm');
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
