import "./edit-date-time-dialog.less";
import ToastrService from "../../../services/toastr.service";
import DispatchService from "../../../services/dispatch.service";
import {Job} from "../../../interfaces/job.interface";
import app from "../../../app";

class EditDateTimeDialogController {
    static $inject = [
        "$mdDialog",
        "toastrService",
        "DispatchData",
        "moment",
        "job",
        "title",
        "fieldName",
        "dateTime",
        "id",
        "showDate",
        "showTime",
    ];

    id: string;
    showDate: boolean;
    showTime: boolean;
    date?: Date;
    time?: Date;
    isLoading: boolean;
    message: { hour: string; minute: string };

    constructor(
        private $mdDialog: angular.material.IDialogService,
        private toastrService: ToastrService,
        private DispatchData: DispatchService,
        private moment: any,
        private job: Job,
        private readonly title: string,
        private readonly fieldName: string,
        dateTime: Date,
        id: string,
        showDate: boolean,
        showTime: boolean
    ) {
        this.id = id;
        this.showDate = showDate;
        this.showTime = showTime;

        this.initializeDateTime(dateTime);

        this.isLoading = false;
        this.message = {
            hour: "Hour is required",
            minute: "Minute is required",
        };
    }

    private initializeDateTime(dateTime: Date): void {
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
            const newDateTime = this.combineDateTime();
            if (newDateTime === null) return;

            await this._updateJobDetail(newDateTime);
            this.showMessageAndCloseDialog();
        } catch (error: any) {
            this.toastrService.showErrorToast(error.message);
        } finally {
            this.isLoading = false;
        }
    }

    private combineDateTime(): Date | null {
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

    private async _updateJobDetail(newDateTime: Date): Promise<void> {
        const formattedDateTime = this.formatDateTime(newDateTime);
        if (formattedDateTime === null) return;

        console.log(`Formated DateTime: ${formattedDateTime}`);

        const callData = {
            call: "updateDetailField",
            field: this.fieldName,
            value: formattedDateTime,
            jobID: this.job.id,
        };
        console.log(`CallData: ${callData}`);

        if (this.job.bulkJob) {
            await this.DispatchData.updateBulkJobDetail(
                this.job.id,
                callData.field,
                callData.value,
                this.job.charge,
                FirstName,
                ContactID
            );
        } else {
            await this.DispatchData.updateJobDetail(
                this.job.id,
                callData.field,
                callData.value,
                this.job.charge,
                this.job.preBook
            );
        }
    }

    private showMessageAndCloseDialog(): void {
        this.toastrService.showSuccessToast(`Updated ${this.title}`);
        this.$mdDialog.hide();
    }

    private formatDateTime(dateTime: Date): string | null {
        // Ensure valid date
        if (!isNaN(dateTime.getTime())) {
            console.warn("Invalid date provided to _formatDateTime");
            return null;
        }

        return this.moment(dateTime).format("YYYY-MM-DDTHH:mm");
    }

    cancel(): void {
        this.$mdDialog.cancel();
    }
}

app.controller("EditDateTimeDialogController", EditDateTimeDialogController);
