/**
 * @class EditDateTimeDialogController
 * @description Controller for the Edit Date/Time dialog in the uDispatch Angular module.
 * This controller handles the logic for editing date and time fields in job details.
 */
class EditDateTimeDialogController {
    /**
     * @type {string[]}
     * @static
     * @description List of dependencies to be injected.
     */
    static $inject = ["$mdDialog", "toastrService", "DispatchData", "moment", "job", "title", "fieldName", "dateTime", "id", "showDate", "showTime"];

    /**
     * @constructor
     * @param {object} $mdDialog - The AngularJS Material service for showing dialogs.
     * @param {object} toastrService - The service to display toast messages.
     * @param {object} DispatchData - The Home Service for dispatch-related data operations.
     * @param {object} moment - The AngularJS directive to interact with moment.js.
     * @param {object} job - The job object being edited.
     * @param {string} title - The title of the dialog.
     * @param {string} fieldName - The name of the field being edited.
     * @param {Date} dateTime - The initial date and/or time to edit.
     * @param {string} id - The ID related to the selection.
     * @param {boolean} showDate - Whether to show the date picker.
     * @param {boolean} showTime - Whether to show the time picker.
     */
    constructor($mdDialog, toastrService, DispatchData, moment, job, title, fieldName, dateTime, id, showDate, showTime) {
        this.$mdDialog = $mdDialog;
        this.toastrService = toastrService;
        this.DispatchData = DispatchData;
        this.moment = moment;

        this.job = job;
        this.title = title;
        this.fieldName = fieldName;
        this.id = id;

        this.showDate = showDate;
        this.showTime = showTime;

        this._initializeDateTime(dateTime);

        this.isLoading = false;
        this.message = {
            hour: "Hour is required", minute: "Minute is required",
        };
    }

    /**
     * @description Initializes the date and time fields based on the provided dateTime.
     * @param {Date} dateTime - The date and time to initialize.
     *
     * @private
     */
    _initializeDateTime(dateTime) {
        let parsedDate;

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

    /**
     * @description Checks if the current date/time selection is valid based on the dialog configuration.
     * @returns {boolean} True if the selection is valid (not null) according to the shown fields, false otherwise.
     */
    isValid() {
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

    /**
     * @description Submits the updated date/time, updates the job details, and closes the dialog.
     * @returns {Promise<void>}
     */
    async submit() {
        try {
            this.isLoading = true;
            const newDateTime = this._combineDateTime();

            await this._updateJobDetail(newDateTime);
            this._showMessageAndCloseDialog();
        } catch (error) {
            this.toastrService.showErrorToast(error.message);
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * @description Combines the selected date and time into a single Date object.
     * @returns {Date|null} The combined date and time, or null if neither is selected.
     *
     * @private
     */
    _combineDateTime() {
        if (this.showDate && this.showTime) {
            const combinedDate = new Date(this.date);
            combinedDate.setHours(this.time.getHours(), this.time.getMinutes());
            return combinedDate;
        } else if (this.showDate) {
            return this.date;
        } else if (this.showTime) {
            return this.time;
        }
        return null;
    }

    /**
     * @description Updates the job detail with the new date/time.
     * @param {Date} newDateTime - The new date and time to update.
     * @returns {Promise<void>}
     *
     * @private
     */
    async _updateJobDetail(newDateTime) {
        const formattedDateTime = this._formatDateTime(newDateTime);
        console.log(`Formated DateTime: ${formattedDateTime}`)

        const callData = {
            "call": "updateDetailField", "field": this.fieldName, "value": formattedDateTime, "jobID": this.job.id
        };
        console.log(`CallData: ${callData}`);

        if (this.job.bulkJob) {
            await this.DispatchData.updateBulkJobDetail(this.job.id, callData.field, callData.value, this.job.charge, FirstName, ContactID);
        } else {
            await this.DispatchData.updateJobDetail(this.job.id, callData.field, callData.value, this.job.charge, FirstName, ContactID, this.job.preBook);
        }
    }

    /**
     * @description Displays a success message and closes the dialog.
     *
     * @private
     */
    _showMessageAndCloseDialog() {
        this.toastrService.showSuccessToast(`Updated ${this.title}`);
        this.$mdDialog.hide();
    }

    /**
     * @description Formats the date/time to the required string format.
     * @param {Date} dateTime - The date and time to format.
     * @returns {string} The formatted date string.
     *
     * @private
     */
    _formatDateTime(dateTime) {
        // Ensure we're working with a valid date
        if (!(dateTime instanceof Date) || isNaN(dateTime.getTime())) {
            console.warn("Invalid date provided to _formatDateTime");
            return null;
        }

        // Use moment directly without creating a new Date object
        return this.moment(dateTime).format("YYYY-MM-DDTHH:mm");
    }

    /**
     * @description Cancels the dialog operation.
     */
    cancel() {
        this.$mdDialog.cancel();
    }
}

angular.module("uDispatch").controller("EditDateTimeDialogController", EditDateTimeDialogController);
