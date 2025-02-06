/**
 * @fileoverview Controller for the Pallet Dialog in the uDispatch application.
 * @module PalletDialogController
 */

/**
 * Controller for the Pallet Dialog
 * @class
 */
class PalletDialogController {
    /**
     * @type {string[]}
     * @static
     * @description List of dependencies to be injected.
     */
    static $inject = ["$scope", "$mdDialog", "DispatchData", "toastrService", "rateJobService", "job", "dispatcherName", "contactId", "existingPallet"];

    /**
     * Create a PalletDialogController.
     * @param {Object} $scope - Angular scope object.
     * @param {Object} $mdDialog - Angular Material dialog service.
     * @param {Object} DispatchData - Service for dispatching data.
     * @param {Object} toastrService - Service for displaying toast notifications.
     * @param {Object} rateJobService - Service for rating jobs.
     * @param {Job} job - The job object.
     * @param {string} dispatcherName - Name of the dispatcher.
     * @param {string} contactId - ID of the contact.
     * @param {Pallet} [existingPallet] - Existing pallet object if editing.
     */
    constructor($scope,
                $mdDialog,
                DispatchData,
                toastrService,
                rateJobService,
                job,
                dispatcherName,
                contactId,
                existingPallet) {
        this.$mdDialog = $mdDialog;
        this.dispatchData = DispatchData;
        this.toastrService = toastrService;
        this._rateJobService = rateJobService;
        this._job = job;
        this.dispatcherName = dispatcherName;
        this.contactId = contactId;

        /** @type {boolean} */
        this.isLoading = false;
        /** @type {Object} */
        this.palletForm = $scope.palletForm;
        /** @type {boolean} */
        this.isEditing = !!existingPallet;

        /** @type {Pallet} */
        this.pallet = existingPallet || {
            id: job.id,
            quantity: 0,
            weight: 0.0,
            length: 0.0,
            depth: 0.0,
            height: 0.0,
            pu: false,
            do: false,
            dgClass: "",
            notes: ""
        };

        /** @type {Array<Object>} */
        this.formFields = [
            {name: "quantity", label: "# of pallets", colSize: "6", value: this.pallet.quantity},
            {name: "weight", label: "Weight (KG)", colSize: "6", value: this.pallet.weight},
            {name: "length", label: "Length (m)", colSize: "6", value: this.pallet.length},
            {name: "depth", label: "Depth (m)", colSize: "6", value: this.pallet.depth},
            {name: "height", label: "Height (m)", colSize: "6", value: this.pallet.height},
            {name: "pu", label: "PU", colSize: "6", type: "checkbox", value: this.pallet.pu},
            {name: "do", label: "DO", colSize: "6", type: "checkbox", value: this.pallet.do},
            {name: "dgClass", label: "DG Class", colSize: "6", value: this.pallet.dgClass},
            {name: "notes", label: "Notes", colSize: "12", type: "textarea", value: this.pallet.notes}
        ];
    }

    /**
     * Submit the pallet form.
     * @returns {Promise<void>}
     */
    async submit() {
        try {
            if (!this.palletForm.$valid) {
                this.toastrService.showWarningToast("Please complete all the required fields.");
                return;
            }
            this.isLoading = true;

            const palletData = this.formFields.reduce((acc, field) => {
                acc[field.name] = field.value;
                return acc;
            }, {});

            let response;
            if (this.isEditing) {
                palletData.id = this.pallet.id;
                palletData.itemId = this.pallet.itemID;
                response = await this.dispatchData.editPallet(palletData, this._job.preBook, this.dispatcherName);
            } else {
                response = await this.dispatchData.addPallet(palletData, this._job.preBook, this.dispatcherName);
            }

            if (response === "OK") {
                if (!this._job.palletInfo) {
                    this._job.palletInfo = [];
                }

                if (this.isEditing) {
                    const index = this._job.palletInfo.findIndex(p => p.id === this.pallet.id);
                    if (index !== -1) {
                        this._job.palletInfo[index] = palletData;
                    }
                } else {
                    this._job.palletInfo.push(palletData);
                }

                const rate = await this._rateJobService.rateJob(this._job);

                if (rate !== this._job.charge) {
                    await this.dispatchData.updateJobDetail(
                        this._job.id,
                        "rate",
                        Number(rate.replace(/[^0-9.-]+/g, "")),
                        Number(rate.replace(/[^0-9.-]+/g, "")),
                        this.dispatcherName,
                        this.contactId,
                        this._job.preBook
                    );
                }

                this.toastrService.showSuccessToast(`Pallet ${this.isEditing ? "updated" : "added"} successfully`);
            }
        } catch (error) {
            this.toastrService.showErrorToast(error.message);
        } finally {
            this.isLoading = false;
        }

        this.$mdDialog.hide();
    }

    /**
     * Cancel the dialog.
     */
    cancel() {
        this.$mdDialog.cancel();
    }
}

angular.module("uDispatch").controller("PalletDialogController", PalletDialogController);
