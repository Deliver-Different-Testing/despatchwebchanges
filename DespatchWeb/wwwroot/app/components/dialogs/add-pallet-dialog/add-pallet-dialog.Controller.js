class AddPalletDialogController {
    constructor($scope,
                $mdDialog,
                DispatchData,
                toastrService,
                rateJobService,
                job,
                dispatcherName,
                contactId) {
        this._$mdDialog = $mdDialog;
        this._dispatchData = DispatchData;
        this._toastrService = toastrService;
        this._rateJobService = rateJobService;
        this._job = job;
        this._dispatherName = dispatcherName;
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
                this._toastrService.showWarningToast("Please complete all the required fields.");
                return;
            }
            this.isLoading = true;

            const response = await this._dispatchData.addPallet(newPallet, this._job.preBook, this._dispatherName);

            console.log(response);

            if (response === "OK") {
                if (!this._job.palletInfo) {
                    this._job.palletInfo = [];
                }

                this._job.palletInfo.push(newPallet);

                const rate = await this._rateJobService.rateJob(this._job);

                console.log(rate);
                if (rate !== this._job.charge) {
                    await this._dispatchData
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
