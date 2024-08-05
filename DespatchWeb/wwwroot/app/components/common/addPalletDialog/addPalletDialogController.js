/**
 * @typedef {Object} Pallet
 * @property {number} amount - The quantity of pallets.
 * @property {number} weight - The weight of the pallet.
 * @property {number} length - The length of the pallet.
 * @property {number} depth - The depth of the pallet.
 * @property {number} height - The height of the pallet.
 * @property {boolean} pu - (Please define what this property does)
 * @property {boolean} do - (Please define what this property does)
 * @property {string} dgClass - (Please define what this property does)
 * @property {string} notes - Any additional comments or notes related to the pallet.
 */

class AddPalletDialogController {
    constructor($scope,
                $mdDialog,
                DispatchData,
                toastrService,
                rateJobService,
                job,
                dispatherName,
                contactId) {
        this.$mdDialog = $mdDialog;
        this.DispatchData = DispatchData;
        this.toastrService = toastrService;
        this.rateJobService = rateJobService;
        this._job = job;
        this._dispatherName = dispatherName;
        this._contactId = contactId;

        this.isLoading = false;
        this.palletForm = $scope.palletForm;

        /** @type {Pallet} */
        this.pallet = {
            id: job.id,
            amount: 0,
            weight: 0.0,
            length: 0.0,
            depth: 0.0,
            height: 0.0,
            pu: false,
            do: false,
            dgClass: "",
            notes: ""
        }
    }

    /**
     * @param {Pallet} newPallet
     */
    async submit(newPallet) {
        try {
            if (!this.palletForm.$valid) {
                this.toastrService.showWarningToast("Please complete all the required fields.");
                return;
            }
            this.isLoading = true;

            const response = await this.DispatchData.addPallet(newPallet, this._job.preBook, this._dispatherName);

            console.log(response);

            if (response === "OK") {
                if (!this._job.palletInfo) {
                    this._job.palletInfo = [];
                }

                this._job.palletInfo.push(newPallet);

                const rate = await this.rateJobService.rateJob(this._job);

                console.log(rate);
                if (rate !== this._job.charge) {
                    await this.DispatchData
                        .updateJobDetail(this._job.id,
                            "rate",
                            Number(rate.replace(/[^0-9.-]+/g, "")),
                            Number(rate.replace(/[^0-9.-]+/g, "")),
                            this._dispatherName,
                            this._contactId,
                            this._job.preBook);
                }
            }
        } catch (error) {
            this.toastrService.showErrorToast(error.message);
        } finally {
            this.isLoading = false;
        }

        this.$mdDialog.hide();
    }

    cancel() {
        this.$mdDialog.cancel();
    }
}
