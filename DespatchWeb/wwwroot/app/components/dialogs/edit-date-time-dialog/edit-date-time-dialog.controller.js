class EditDateTimeDialogController {
    static $inject = [
        '$mdDialog',
        'toastrService',
        'DispatchData',
        'moment',
        'job',
        'title',
        'fieldName',
        'dateTime',
        'id',
        'showDate',
        'showTime'
    ];

    /**
     * @param $mdDialog - The AngularJS Material service for showing dialogs.
     * @param toastrService - The service to display toast messages
     * @param DispatchData - The Home Service
     * @param moment - The AngularJS directive to interact with moment.js
     * @param {Job} job
     * @param {string} id - The ID related to the selection.
     * @param {string} fieldName - The name of the field for which the selection is being made.
     * @param {string} title - The title of the dialog.
     * @param {Date} dateTime - The date and/or time to edit
     * @param {boolean} showDate - Whether to show the date picker
     * @param {boolean} showTime - Whether to show the time picker
     */
    constructor($mdDialog, toastrService, DispatchData, moment, job, title, fieldName, dateTime, id, showDate, showTime) {
        this._$mdDialog = $mdDialog;
        this._toastrService = toastrService;
        this._dispatchData = DispatchData;
        this._moment = moment;

        this._job = job;
        this.title = title;
        this.fieldName = fieldName;
        this.id = id;

        this.showDate = showDate;
        this.showTime = showTime;

        this.initializeDateTime(dateTime);

        this.isLoading = false;
        this.message = {
            hour: 'Hour is required',
            minute: 'Minute is required',
        };
    }

    initializeDateTime(dateTime) {
        let parsedDate;

        if (dateTime === null || dateTime === undefined || isNaN(new Date(dateTime).getTime())) {
            console.warn('Invalid or null date provided. Using current date/time.');
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

    isValid() {
        if (this.showDate && this.showTime) {
            return this.date && this.time;
        } else if (this.showDate) {
            return this.date;
        } else if (this.showTime) {
            return this.time;
        }
        return false;
    }

    async submit() {
        try {
            this.isLoading = true;
            const newDateTime = this._combineDateTime();
            await this._updateJobDetail(newDateTime);
            this._updateJobField(newDateTime);
            this._showMessageAndCloseDialog();
        } catch (error) {
            this._toastrService.showErrorToast(error.message);
        } finally {
            this.isLoading = false;
        }
    }

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

    async _updateJobDetail(newDateTime) {
        const formattedDateTime = this._formatDateTime(newDateTime);
        const callData = {
            "call": "updateDetailField",
            "field": this.fieldName,
            "value": formattedDateTime,
            "jobID": this._job.id
        };

        if (this._job.bulkJob) {
            await this._dispatchData.updateBulkJobDetail(
                this._job.id,
                callData.field,
                callData.value,
                this._job.charge,
                FirstName,
                ContactID
            );
        } else {
            await this._dispatchData.updateJobDetail(
                this._job.id,
                callData.field,
                callData.value,
                this._job.charge,
                FirstName,
                ContactID,
                this._job.preBook
            );
        }
    }

    _updateJobField(newDateTime) {
        let fieldName = this.fieldName.toLowerCase();
        let matchingField = Object.keys(this._job).find(key => key.toLowerCase() === fieldName);

        if (matchingField) {
            this._job[matchingField] = newDateTime;
        } else {
            console.warn(`Field ${this.fieldName} not found in job object.`);
        }
    }

    _showMessageAndCloseDialog() {
        this._toastrService.showSuccessToast("Updated " + this.title);
        this._$mdDialog.hide(this._job);
    }

    _formatDateTime(dateTime) {
        return new Date(this._moment(dateTime).format("YYYY-MM-DDTHH:mm"));
    }

    cancel() {
        this._$mdDialog.cancel();
    }
}

angular.module('uDispatch').controller('EditDateTimeDialogController', EditDateTimeDialogController);
