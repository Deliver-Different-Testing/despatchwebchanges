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
    static $inject = ["$mdDialog", "DispatchData", "toastrService", "rateJobService", "id", "fieldName", "title", "job", "options", "initialValue", "showCheckbox", "checkboxLabel"];

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
        this.$mdDialog = $mdDialog;
        this.DispatchData = DispatchData;
        this.toastrService = toastrService;
        this.rateJobService = rateJobService;
        this.showCheckbox = !showCheckbox ? false : showCheckbox;
        this.checkboxLabel = !checkboxLabel ? "" : checkboxLabel;

        this.isLoading = false;
        this.id = id;
        this.title = title;
        this.job = job;
        this.fieldName = fieldName;
        this.options = options;
        this.selectedOption = null;

        // Warning message
        this.warningMessage = fieldName === "Status" ?
            "Warning: You are about to change the status of a job. Different statuses trigger different notifications and automated workflows. " +
            "While this change can be reversed, it may impact multiple systems and stakeholders. Please ensure you're selecting the correct status."
            : "";
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
        return options.items.find(option =>
            option.text === initialValue || option.id === initialValue
        ) ?? null;
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

            if (this.fieldName === "DGClass") {
                await this._updateDgClass(selectedOption);
                this.job.dgClass = selectedOption.id;
            } else {
                await this._updateJobDetails(selectedOption);
            }

            this.$mdDialog.hide();
        } catch (error) {
            this.toastrService.showErrorToast(error.message);
        } finally {
            this.isLoading = false;
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
        this.job.charge = await this.rateJobService.rateJob(this.job);

        if (this.job.bulkJob) {
            await this.DispatchData.updateBulkJobDetail(this.job.id, this.fieldName, selectedOption.id, this.job.charge, FirstName, ContactID);
        } else {
            await this.DispatchData.updateJobDetail(this.job.id, this.fieldName, selectedOption.id, this.job.charge, FirstName, ContactID);
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
        await this.DispatchData.updateJobDetail(this.job.id, this.fieldName, selectedOption.id, this.job.charge, FirstName, ContactID, this.job.preBook);

        if (this.job.dgDocumentation !== this.checkboxValue) {
            this.job.dgDocumentation = this.checkboxValue;
            await this.DispatchData.updateJobDetail(this.job.id, "DGDocumentation", this.job.dgDocumentation, this.job.charge, FirstName, ContactID, this.job.preBook);
        }
    }

    /**
     * Cancels the Angular Material Dialog.
     */
    cancel() {
        this.$mdDialog.cancel();
    }
}

angular.module("uDispatch").controller("SelectDialogController", SelectDialogController);
