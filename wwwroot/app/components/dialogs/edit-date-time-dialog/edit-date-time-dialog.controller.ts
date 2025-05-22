import "./edit-date-time-dialog.less";
import ToastrService from "../../../services/toastr.service";
import {IDialogDateTimeResult} from "../../../interfaces/dialog-result.interfaces";
import {Suggestion, TimeZoneSuggestion} from "../../../interfaces/job.interface";
import BaseController from "../../base-controller";
import {JobProperty} from "../../../enums/job-property.enum";
import {findWindows} from "windows-iana";
import dayjs from "dayjs";

export class EditDateTimeDialogController extends BaseController {
    static $inject = [
        "$mdDialog",
        "toastrService",
        "$timeout",
        "$interval",
        "title",
        "fieldName",
        "dateTime",
        "showTimeZone",
        "defaultTimeZone",
        "showDate",
        "showTime",
    ];

    isLoading?: boolean;
    browserTimeZone?: string;
    selectedTimeZone?: TimeZoneSuggestion;

    constructor(
        private $mdDialog: angular.material.IDialogService,
        private toastrService: ToastrService,
        $timeout: angular.ITimeoutService,
        $interval: angular.IIntervalService,
        public readonly title: string,
        public readonly fieldName: JobProperty,
        public dateTime?: Date,
        public showTimeZoneSelector: boolean = false,
        private defaultTimeZone?: Suggestion,
        public showDate: boolean = true,
        public showTime: boolean = true,
    ) {
        super();
        this.initServices($timeout, $interval);

        console.log('EditDateTimeDialogController: Controller instantiated');

        // Ensure we have a valid date to start with
        this.registerTimeout(() => {
            if (!this.dateTime || !dayjs(this.dateTime).isValid()) {
                this.dateTime = dayjs().toDate();
            }
        })

        const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        this.browserTimeZone = findWindows(browserTimeZone)[0];

        if (this.showTimeZoneSelector && this.defaultTimeZone) {
            this.selectedTimeZone = {
                id: this.defaultTimeZone?.id,
                text: findWindows(this.defaultTimeZone?.text)[0],
                timeZoneIana: this.defaultTimeZone?.text
            }
            console.log('Selected timezone:', this.selectedTimeZone);
        }

        this.isLoading = false;
    }

    isValid(): boolean {
        if (!this.dateTime || !dayjs(this.dateTime).isValid()) {
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
        if(this.dateTime === undefined) {
            this.toastrService.showWarningToast('Invalid date/time');
            return;
        }

        try {
            this.isLoading = true;
            // Create result object
            const result: IDialogDateTimeResult = {
                fieldName: this.fieldName,
                value: this.getFormattedDate(this.dateTime),
                selectedTimeZoneId: this.selectedTimeZone?.id
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

    getFormattedDate(dateTime: Date): string {
        if (dateTime === undefined) {
            this.toastrService.showErrorToast('Invalid date/time');
            return '';
        }

        return dayjs(dateTime).format('YYYY-MM-DD HH:mm');
    }

    cancel(): void {
        this.$mdDialog.cancel();
    }
}
