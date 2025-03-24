import "./edit-date-time-dialog.less";
import ToastrService from "../../../services/toastr.service";
import app from "../../../app";
import {IDialogDateTimeResult} from "../../../interfaces/dialog-result.interfaces";

export class EditDateTimeDialogController {
    static $inject = [
        "$mdDialog",
        "toastrService",
        "moment",
        "title",
        "fieldName",
        "dateTime",
        "showDate",
        "showTime",
    ];

    showDate: boolean;
    showTime: boolean;
    date?: Date;
    time?: Date;
    isLoading: boolean;
    message: { hour: string; minute: string };

    constructor(
        private $mdDialog: angular.material.IDialogService,
        private toastrService: ToastrService,
        private moment: any,
        public readonly title: string,
        public readonly fieldName: string,
        dateTime: Date,
        showDate: boolean,
        showTime: boolean
    ) {
        this.showDate = showDate;
        this.showTime = showTime;

        this._initializeDateTime(dateTime);

        this.isLoading = false;
        this.message = {
            hour: "Hour is required",
            minute: "Minute is required",
        };
    }

    private _initializeDateTime(dateTime: Date): void {
        let parsedDate: Date;

        if (dateTime === null || dateTime === undefined || isNaN(new Date(dateTime).getTime())) {
            console.warn("Invalid or null date provided. Using current date/time.");
            parsedDate = new Date();
        } else {
            parsedDate = new Date(dateTime);
        }

        if (this.showDate) {
            this.date = new Date(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate());
        }
        if (this.showTime) {
            this.time = new Date(1970, 0, 1, parsedDate.getHours(), parsedDate.getMinutes());
        }
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

            const formattedDateTime = this._formatDateTime(newDateTime);
            if (formattedDateTime === null) return;

            // Create result object
            const result: IDialogDateTimeResult = {
                fieldName: this.fieldName,
                value: formattedDateTime,
                formattedDateTime: formattedDateTime
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

    private _formatDateTime(dateTime: Date): string | null {
        // Ensure valid date
        if (isNaN(dateTime.getTime())) {
            console.warn("Invalid date provided to formatDateTime");
            return null;
        }

        return this.moment(dateTime).format("YYYY-MM-DDTHH:mm");
    }

    cancel(): void {
        this.$mdDialog.cancel();
    }
}
