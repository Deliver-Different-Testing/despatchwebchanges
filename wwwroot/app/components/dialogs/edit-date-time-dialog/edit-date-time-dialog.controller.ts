import "./edit-date-time-dialog.less";
import ToastrService from "../../../services/toastr.service";
import {IDialogDateTimeResult} from "../../../interfaces/dialog-result.interfaces";
import {ISuggestion} from "../../../interfaces/job.interface";
import BaseController from "../../base-controller";
import {JobProperty} from "../../../enums/job-property.enum";
import {TimeZone} from "../../../contants";
import dayjs, {Dayjs} from "dayjs";
import timezone from "dayjs/plugin/timezone";
import {formatDateForApiWithTzs} from "../../../functions/formatDates";

dayjs.extend(timezone);

export class EditDateTimeDialogController extends BaseController {
    static $inject = [
        "$mdDialog",
        "$log",
        "toastrService",
        "$timeout",
        "$interval",
        "title",
        "fieldName",
        "dateTime",
        "defaultTimeZone",
        "showDate",
        "showTime",
    ];

    isLoading: boolean = false;
    browserTimeZone?: string;
    selectedTimeZone: string;
    selectedDate?: Date;
    selectedTime?: Date;

    constructor(
        private $mdDialog: angular.material.IDialogService,
        private $log: angular.ILogService,
        private toastrService: ToastrService,
        $timeout: angular.ITimeoutService,
        $interval: angular.IIntervalService,
        public readonly title: string,
        public readonly fieldName: JobProperty,
        public dateTime?: Dayjs,
        defaultTimeZone?: ISuggestion,
        public showDate: boolean = true,
        public showTime: boolean = true,
    ) {
        super();
        this.initServices($timeout, $interval);

        this.browserTimeZone = dayjs.tz.guess();
        this.selectedTimeZone = defaultTimeZone?.text ?? TimeZone;

        this.initializeDateTimeInputs();

        if (!this.dateTime) {
            console.log('No dateTime provided, setting to current time');
            this.dateTime = dayjs();
            console.log('Current time:', this.dateTime);
            console.log('Selected time zone:', this.selectedTimeZone);
            this.initializeDateTimeInputs();
        }
    }

    private initializeDateTimeInputs(): void {
        if (this.dateTime) {
            // Convert existing dateTime to dayjs object
            const dateTimeValue = dayjs(this.dateTime);
            this.selectedDate = dateTimeValue.toDate();
            this.selectedTime = dateTimeValue.toDate();
        } else {
            // Use the current time
            const now = dayjs();
            this.selectedDate = now.toDate();
            this.selectedTime = now.toDate();
        }
    }

    updateDateTime(): void {
        try {
            if (this.showDate && this.showTime) {
                // Both date and time required
                if (this.selectedDate && this.selectedTime) {
                    const dateValue = dayjs(this.selectedDate);
                    const timeValue = dayjs(this.selectedTime);

                    // Combine date and time
                    this.dateTime = dateValue
                        .hour(timeValue.hour())
                        .minute(timeValue.minute())
                        .second(0)
                        .millisecond(0);
                }
            } else if (this.showDate && !this.showTime) {
                // Date only - set to midnight (00:00:00)
                if (this.selectedDate) {
                    this.dateTime = dayjs(this.selectedDate)
                        .startOf('day');
                }
            } else if (this.showTime && !this.showDate) {
                // Time only - use minimum date (1900-01-01) with the selected time
                if (this.selectedTime) {
                    const timeValue = dayjs(this.selectedTime);
                    this.dateTime = dayjs('1900-01-01')
                        .hour(timeValue.hour())
                        .minute(timeValue.minute())
                        .second(0)
                        .millisecond(0);
                }
            }

            if (this.dateTime) {
                this.$log.debug('DateTime updated:', formatDateForApiWithTzs(this.dateTime, this.selectedTimeZone));
            } else {
                this.$log.debug('DateTime not updated');
            }
        } catch (error) {
            this.$log.error('Error updating dateTime:', error);
            this.dateTime = undefined;
        }
    }

    isValid(): boolean {
        // Check if required inputs are provided based on what should be shown
        if (this.showDate && this.showTime) {
            return !!(this.selectedDate && this.selectedTime && this.dateTime);
        } else if (this.showDate && !this.showTime) {
            return !!(this.selectedDate && this.dateTime);
        } else if (this.showTime && !this.showDate) {
            return !!(this.selectedTime && this.dateTime);
        }

        return !!(this.dateTime);
    }

    async submit(): Promise<void> {
        if (!this.isValid()) {
            this.toastrService.showWarningToast('Please provide valid date/time information');
            return;
        }

        try {
            this.isLoading = true;

            const result: IDialogDateTimeResult = {
                fieldName: this.fieldName,
                value: this.dateTime,
                timezone: this.selectedTimeZone,
            };

            this.$log.debug('Submitting result:', result);
            this.$mdDialog.hide(result);
        } catch (error: any) {
            this.$log.error('Error submitting date/time:', error);
            this.toastrService.showErrorToast(error.message);
        } finally {
            this.isLoading = false;
        }
    }

    cancel(): void {
        this.$mdDialog.cancel();
    }
}