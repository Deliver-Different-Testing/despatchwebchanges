import "./edit-date-time-dialog.less";
import ToastrService from "../../../services/toastr.service";
import {IDialogDateTimeResult} from "../../../interfaces/dialog-result.interfaces";
import {ISuggestion} from "../../../interfaces/job.interface";
import BaseController from "../../base-controller";
import {JobProperty} from "../../../enums/job-property.enum";
import {TimeZone} from "../../../contants";
import dayjs, {Dayjs} from "dayjs";
import timezone from "dayjs/plugin/timezone";
import {formatDateForApiWithTzs, getIanaTimezone} from "../../../functions/formatDates";
import {timezoneLongFilter} from "../../../filters";
import {IAppConfig} from "../../../interfaces/app-config.interface";

dayjs.extend(timezone);

export class EditDateTimeDialogController extends BaseController {
    static $inject = [
        "$mdDialog",
        "toastrService",
        "$timeout",
        "$interval",
        "APP_CONFIG",
        "title",
        "fieldName",
        "dateTime",
        "defaultTimeZone",
        "showDate",
        "showTime",
    ];

    isLoading: boolean = false;
    readonly isUsCustomer: boolean;
    readonly browserTimeZoneStr: string;
    readonly selectedTimeZoneStr: string;
    private readonly selectedTimeZone: string;

    constructor(
        private $mdDialog: angular.material.IDialogService,
        private toastrService: ToastrService,
        $timeout: angular.ITimeoutService,
        $interval: angular.IIntervalService,
        appConfig: IAppConfig,
        public readonly title: string,
        public readonly fieldName: JobProperty,
        public dateTime?: Dayjs,
        defaultTimeZone?: ISuggestion,
        public showDate: boolean = true,
        public showTime: boolean = true,
    ) {
        super();
        this.initServices($timeout, $interval);
        this.isUsCustomer = appConfig.US_Customer;

        const browserIanaTimeZone = getIanaTimezone(dayjs.tz.guess());
        this.browserTimeZoneStr = timezoneLongFilter(browserIanaTimeZone)

        this.selectedTimeZone = defaultTimeZone?.text ?? getIanaTimezone(TimeZone)
        this.selectedTimeZoneStr = timezoneLongFilter(this.selectedTimeZone);

        if (!this.dateTime || !this.dateTime.isValid()) {
            console.log('No dateTime provided, setting to current time');
            this.dateTime = dayjs();
            console.log('Current time:', this.dateTime);
            console.log('Selected time zone:', this.selectedTimeZone);
        }
    }

    updateDateTime(dateTime: Dayjs): void {
        try {
            if (!dateTime.isValid()) {
                console.error("Returned datetime is invalid!");
                return;
            }

            if (this.showDate && this.showTime) {
                // Both date and time required
                this.dateTime = dateTime;
            } else if (this.showDate && !this.showTime) {
                // Date only - set to midnight (00:00:00)
                this.dateTime = dateTime.startOf('day');
            } else if (this.showTime && !this.showDate) {
                // Time only - use minimum date (1900-01-01) with the selected time
                this.dateTime = dayjs('1900-01-01')
                    .hour(dateTime.hour())
                    .minute(dateTime.minute())
                    .second(0)
                    .millisecond(0);
            }

            if (this.dateTime) {
                console.log('DateTime updated:', formatDateForApiWithTzs(this.dateTime, this.selectedTimeZoneStr));
            } else {
                console.log('DateTime not updated');
            }
        } catch (error) {
            console.error('Error updating dateTime:', error);
            this.dateTime = undefined;
        }
    }

    async submit(): Promise<void> {
        if (!this.dateTime?.isValid()) {
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

            console.log('Submitting result:', result);
            this.$mdDialog.hide(result);
        } catch (error: any) {
            console.error('Error submitting date/time:', error);
            this.toastrService.showErrorToast(error.message);
        } finally {
            this.isLoading = false;
        }
    }

    cancel(): void {
        this.$mdDialog.cancel();
    }
}