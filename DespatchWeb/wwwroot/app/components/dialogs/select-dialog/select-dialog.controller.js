/**
 * A controller which handles the Selection Dialog.
 * @class
 */
class SelectDialogController {
    /**
     * @type {string[]}
     * @static
     * @description List of dependencies to be injected.
     */
    static $inject = ['$mdDialog', 'DispatchData', 'toastrService', 'rateJobService', 'id', 'fieldName', 'title', 'job', 'options', 'initialValue', 'showCheckbox', 'checkboxLabel'];

    /**
     * Create a SelectDialogController
     * @constructor
     * @param {Object} $mdDialog - The AngularJS Material service for showing dialogs.
     * @param {Object} DispatchData - The service used for data dispatching.
     * @param {Object} toastrService - The service to display toast messages.
     * @param {Object} rateJobService - The service for rating jobs.
     * @param {number} id - The ID related to the selection.
     * @param {string} fieldName - The name of the field for which the selection is being made.
     * @param {string} title - The title of the dialog.
     * @param {Object} job - The job for which the selection is being made.
     * @param {Object} options - The array of selectable options.
     * @param {string|null} initialValue - The currently selected option if there is one.
     * @param {boolean} showCheckbox - Determines if the checkbox option should be shown on the view.
     * @param {string} checkboxLabel - Label to display for the checkbox if shown to view.
     */
    constructor($mdDialog, DispatchData, toastrService, rateJobService, id, fieldName, title, job, options, initialValue, showCheckbox, checkboxLabel) {
        this._$mdDialog = $mdDialog;
        this._dispatchData = DispatchData;
        this.toastrService = toastrService;
        this.rateJobService = rateJobService;
        this.showCheckbox = !showCheckbox ? false : showCheckbox;
        this.checkboxLabel = !checkboxLabel ? "" : checkboxLabel;

        this.isLoading = false;
        this.id = id;
        this.title = title;
        this._job = job;
        this._fieldName = fieldName;
        this.options = options;
        this.selectedOption = null;

        /** @type {boolean} */
        this.checkboxValue = false;

        if (initialValue) {
            this.selectedOption = this._findInitialValue(options, initialValue);
        }
    }

    /**
     * Finds the initial value in the options array.
     * @private
     * @param {Object} options - The array of selectable options.
     * @param {string} initialValue - The value to find in the options.
     * @returns {Object|null} The found option or null if not found.
     */
    _findInitialValue(options, initialValue) {
        return options.items.find(option => option.text === initialValue) ?? null;
    }

    /**
     * Submits the selected value, updates the job detail, and closes the dialog.
     * @async
     * @param {Object} selectedOption - The selected value from the options.
     * @returns {Promise<void>}
     */
    async submit(selectedOption) {
        try {
            this.isLoading = true;

            if (this._fieldName === "DGClass") {
                await this._updateDgClass(selectedOption);
                this._job.dgClass = selectedOption.id;
            } else {
                this._updateJobFields(selectedOption);
                await this._updateJobDetails(selectedOption);
            }

            this._$mdDialog.hide();
        } catch (error) {
            this.toastrService.showErrorToast(error.message);
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * Updates various job fields based on the selected option.
     * @private
     * @param {Object} selectedOption - The selected option.
     */
    _updateJobFields(selectedOption) {
        switch (this._fieldName) {
            case "Size":
                this._job.size.text = selectedOption.text;
                this._job.size.id = selectedOption.id;
                break;
            case "SpeedID":
                this._job.speedName = selectedOption.text;
                this._job.speedId = selectedOption.id;
                break;
            case "AcceptedJobTypeID":
                this._job.acceptedName = selectedOption.text;
                this._job.acceptedJobTypeID = selectedOption.id;
                break;
            case "NotifiedJobTypeID":
                this._job.notifiedName = selectedOption.text;
                this._job.notifiedId = selectedOption.id;
                break;
            case "TrackingMethod":
                this._job.trackingMethod = selectedOption.id;
                break;
            case "DeliverToLeaveID":
                this._job.sigNotRequired = selectedOption.text;
                this._job.deliverToLeaveId = selectedOption.id;
                break;
            case "UndeliverableLocationID":
                this._job.udStatus = selectedOption.text;
        }
    }

    /**
     * Updates the job details including rating the job.
     * @private
     * @async
     * @param {Object} selectedOption - The selected option.
     * @returns {Promise<void>}
     */
    async _updateJobDetails(selectedOption) {
        this._job.charge = await this.rateJobService.rateJob(this._job);

        if (this._job.bulkJob) {
            await this._dispatchData.updateBulkJobDetail(this._job.id, this._fieldName, selectedOption.id, this._job.charge, FirstName, ContactID);
        } else {
            await this._dispatchData.updateJobDetail(this._job.id, this._fieldName, selectedOption.id, this._job.charge, FirstName, ContactID);
        }
    }

    /**
     * Updates the DG Class and DG Documentation if necessary.
     * @private
     * @async
     * @param {Object} selectedOption - The selected option for DG Class.
     * @returns {Promise<void>}
     */
    async _updateDgClass(selectedOption) {
        await this._dispatchData.updateJobDetail(this._job.id, this._fieldName, selectedOption.id, this._job.charge, FirstName, ContactID, this._job.preBook);

        if (this._job.dgDocumentation !== this.checkboxValue) {
            this._job.dgDocumentation = this.checkboxValue;
            await this._dispatchData.updateJobDetail(this._job.id, "DGDocumentation", this._job.dgDocumentation, this._job.charge, FirstName, ContactID, this._job.preBook);
        }
    }

    /**
     * Cancels the Angular Material Dialog.
     */
    cancel() {
        this._$mdDialog.cancel();
    }
}

angular.module('uDispatch').controller('SelectDialogController', SelectDialogController);
