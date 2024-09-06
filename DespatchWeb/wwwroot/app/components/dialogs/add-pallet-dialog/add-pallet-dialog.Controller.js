class PalletDialogController {
    static $inject = ['$scope', '$mdDialog', 'DispatchData', 'toastrService', 'rateJobService', 'job', 'dispatcherName', 'contactId', 'existingPallet'];

    constructor($scope,
                $mdDialog,
                DispatchData,
                toastrService,
                rateJobService,
                job,
                dispatcherName,
                contactId,
                existingPallet) {
        this._$mdDialog = $mdDialog;
        this._dispatchData = DispatchData;
        this._toastrService = toastrService;
        this._rateJobService = rateJobService;
        this._job = job;
        this._dispatcherName = dispatcherName;
        this._contactId = contactId;

        this.isLoading = false;
        this.palletForm = $scope.palletForm;
        this.isEditing = !!existingPallet;

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

    async submit() {
        try {
            if (!this.palletForm.$valid) {
                this._toastrService.showWarningToast("Please complete all the required fields.");
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
                response = await this._dispatchData.editPallet(palletData, this._job.preBook, this._dispatcherName);
            } else {
                response = await this._dispatchData.addPallet(palletData, this._job.preBook, this._dispatcherName);
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
                    await this._dispatchData.updateJobDetail(
                        this._job.id,
                        "rate",
                        Number(rate.replace(/[^0-9.-]+/g, "")),
                        Number(rate.replace(/[^0-9.-]+/g, "")),
                        this._dispatcherName,
                        this._contactId,
                        this._job.preBook
                    );
                }

                this._toastrService.showSuccessToast(`Pallet ${this.isEditing ? 'updated' : 'added'} successfully`);
            }
        } catch (error) {
            this._toastrService.showErrorToast(error.message);
        } finally {
            this.isLoading = false;
        }

        this._$mdDialog.hide();
    }

    cancel() {
        this._$mdDialog.cancel();
    }
}

angular.module('uDispatch').controller('PalletDialogController', PalletDialogController);
