import "./edit-date-time-dialog.less";
import ToastrService from "../../../services/toastr.service";
import {IDialogDateTimeResult} from "../../../interfaces/dialog-result.interfaces";
import moment from "moment";
import "moment-timezone";
import DispatchCoreService from "../../../services/dispatch-core.service";
import {Suggestion, TimeZoneSuggestion} from "../../../interfaces/job.interface";
import BaseController from "../../base-controller";

export class EditDateTimeDialogController extends  BaseController {
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

    date?: Date;
    time?: Date;
    isLoading: boolean;
    message: { hour: string; minute: string };
    browserTimeZone: string;
    selectedTimeZone?: TimeZoneSuggestion;
    timeZones?: TimeZoneSuggestion[];
    showTimeZoneSelector: boolean = false;

    constructor(
        private $mdDialog: angular.material.IDialogService,
        private toastrService: ToastrService,
        private DispatchData: DispatchCoreService,
        public readonly title: string,
        public readonly fieldName: string,
        public dateTime: Date,
        private defaultTimeZone?: Suggestion,
        showTimeZoneSelector: boolean = false,
        public showDate: boolean = false,
        public showTime: boolean = false,
    ) {
        super();

        this.showTimeZoneSelector = showTimeZoneSelector;

        if(this.dateTime === undefined) {
            this.dateTime = new Date();
        }

        // Get a list of time zones if needed
        if(showTimeZoneSelector) {
            this.DispatchData.getTimeZoneOptions().then((data: TimeZoneSuggestion[]) => {
                this.timeZones = data;

                if(this.defaultTimeZone) {
                    this.selectedTimeZone = data.find(tz => tz.id === this.defaultTimeZone?.id);
                }
            });
        }

        // Get browser timezone
        this.browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

        this.isLoading = false;
        this.message = {
            hour: "Hour is required",
            minute: "Minute is required",
        };
    }

    isValid(): boolean {
        if (this.showDate && this.showTime) {
            return this.date !== null && this.time !== null;
        } else if (this.showDate) {
            return this.date !== null;
        } else if (this.showTime) {
            return this.time !== null;
        }

        // If made it this far, something went wrong
        return false;
    }

    async submit(): Promise<void> {
        try {
            this.isLoading = true;
            const newDateTime = this._combineDateTime();
            if (newDateTime === null) return;

            // Create result object
            const result: IDialogDateTimeResult = {
                fieldName: this.fieldName,
                value: newDateTime,
                selectedTimeZone: this.selectedTimeZone
            };

            this.$mdDialog.hide(result);
        } catch (error: any) {
            this.toastrService.showErrorToast(error.message);
        } finally {
            this.isLoading = false;
        }
    }

    private _combineDateTime(): Date | null {
        if (this.showDate && this.showTime) {
            const combinedDate = new Date(this.date as Date);
            combinedDate.setHours((this.time as Date).getHours(), (this.time as Date).getMinutes());
            return combinedDate;
        } else if (this.showDate) {
            return this.date || null;
        } else if (this.showTime) {
            return this.time || null;
        }

        return null;
    }

// Get current time in selected timezone for display
    getCurrentTimeInSelectedTimeZone(): string {
        return moment().tz(this.selectedTimeZone?.text ?? this.browserTimeZone).format('HH:mm');
    }

    cancel(): void {
        this.$mdDialog.cancel();
    }
}
