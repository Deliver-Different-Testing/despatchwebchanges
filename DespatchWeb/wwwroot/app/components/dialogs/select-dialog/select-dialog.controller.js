/**
 * A controller which handles the Selection Dialog.
 * @class
 */
class SelectDialogController {
    static $inject = ['$mdDialog', 'DispatchData', 'toastrService', 'rateJobService', 'id', 'fieldName', 'title', 'job', 'options', 'initialValue', 'showCheckbox', 'checkboxLabel'];

    /**
     * Create a SelectDialogController
     * @param $mdDialog - The AngularJS Material service for showing dialogs.
     * @param DispatchData - The service used for data dispatching.
     * @param toastrService - The service to display toast messages
     * @param rateJobService
     * @param {number} id - The ID related to the selection.
     * @param {string} fieldName - The name of the field for which the selection is being made.
     * @param {string} title - The title of the dialog.
     * @param {Job} job - The job for which the selection is being made.
     * @param {SelectOption[]} options - The array of selectable options.
     * @param {string|null} initialValue - The currently selected option if there is one
     * @param {boolean} showCheckbox - Determines if the checkbox option should be shown on the view
     * @param {string} checkboxLabel - Label to display for the checkbox if shown to view
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

        // New checkboxValue property initialized with false
        this.checkboxValue = false;

        if (initialValue) {
            this.selectedOption = this._findInitialValue(options, initialValue);
        }
    }

    _findInitialValue(options, initialValue) {
        return options.items.find(option => option.text === initialValue) ?? null;
    }

    /**
     * Submits the selected value, updates the job detail, and closes the dialog.
     * @param {SelectOption} selectedOption - The selected value from the options.
     */
    async submit(selectedOption) {
        try {
            this.isLoading = true;

            if (this._fieldName === "DGClass") {
                await this._updateDgClass(selectedOption);
                this._job.dgClass = selectedOption.id;
            } else {
                if (this._fieldName === "Size") {
                    this._job.size.label = selectedOption.text;
                    this._job.size.id = selectedOption.id;
                    this._job.van = true;
                }

                if (this._fieldName === "SpeedID") {
                    this._job.speedName = selectedOption.text;
                    this._job.speedId = selectedOption.id;
                }

                if (this._fieldName === "AcceptedJobTypeID") {
                    this._job.acceptedName = selectedOption.text;
                    this._job.acceptedJobTypeID = selectedOption.id;
                }

                if (this._fieldName === "NotifiedJobTypeID") {
                    this._job.notifiedName = selectedOption.text;
                    this._job.notifiedId = selectedOption.id;
                }

                // Rate job
                this._job.charge = await this.rateJobService.rateJob(this._job);

                this._job.bulkJob ?
                    await this._dispatchData.updateBulkJobDetail(this._job.id, this._fieldName, selectedOption.id, this._job.charge, FirstName, ContactID) :
                    await this._dispatchData.updateJobDetail(this._job.id, this._fieldName, selectedOption.id, this._job.charge, FirstName, ContactID);
            }

            this._$mdDialog.hide();
        } catch (error) {
            this.toastrService.showErrorToast(error.message);
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * @param {SelectOption} selectedOption
     */
    async _updateDgClass(selectedOption) {
        // Update Dg Class
        await this._dispatchData
            .updateJobDetail(this._job.id, this._fieldName, selectedOption.id, this._job.charge, FirstName, ContactID, this._job.preBook);

        if (this._job.dgDocumentation !== this.checkboxValue) {
            this._job.dgDocumentation = this.checkboxValue;
            await this._dispatchData
                .updateJobDetail(this._job.id, "DGDocumentation", this._job.dgDocumentation, this._job.charge, FirstName, ContactID, this._job.preBook);
        }
    }

    /**
     * Cancels the Angular Material Dialog
     */
    cancel() {
        this._$mdDialog.cancel();
    }
}

angular.module('uDispatch').controller('SelectDialogController', SelectDialogController);
