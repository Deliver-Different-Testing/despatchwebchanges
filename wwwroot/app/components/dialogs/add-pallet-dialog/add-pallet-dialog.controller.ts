import DispatchService from "../../../services/dispatch.service";
import ToastrService from "../../../services/toastr.service";
import {Job, PalletInfo} from "../../../interfaces/job.interface";
import app from "../../../app";

interface PalletDialogControllerScope extends angular.IScope {
    palletForm: any;
}

class PalletDialogController {
    static $inject = ["$scope", "$mdDialog", "DispatchData", "toastrService", "rateJobService", "job", "dispatcherName", "contactId", "existingPallet"];

    public isLoading: boolean;
    public palletForm: any;
    public isEditing: boolean;
    public pallet: any;
    public formFields: Array<any>;

    constructor(
        $scope: PalletDialogControllerScope,
        private $mdDialog: angular.material.IDialogService,
        private dispatchData: DispatchService,
        private toastrService: ToastrService,
        private rateJobService: any,
        private job: Job,
        private dispatcherName: string,
        private contactId: number,
        existingPallet?: PalletInfo
    ) {

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


    async submit(): Promise<void> {
        try {
            if (!this.palletForm.$valid) {
                this.toastrService.showWarningToast("Please complete all the required fields.");
                return;
            }
            this.isLoading = true;

            const palletData = this.formFields.reduce((acc: any, field: any) => {
                acc[field.name] = field.value;
                return acc;
            }, {});

            let response;
            if (this.isEditing) {
                palletData.id = this.pallet.id;
                palletData.itemId = this.pallet.itemID;
                response = await this.dispatchData.editPallet(palletData, this.job.preBook, this.dispatcherName);
            } else {
                response = await this.dispatchData.addPallet(palletData, this.job.preBook, this.dispatcherName);
            }

            if (response === "OK") {
                if (!this.job.palletInfo) {
                    this.job.palletInfo = [];
                }

                if (this.isEditing) {
                    const index = this.job.palletInfo.findIndex((p: any) => p.id === this.pallet.id);
                    if (index !== -1) {
                        this.job.palletInfo[index] = palletData;
                    }
                } else {
                    this.job.palletInfo.push(palletData);
                }

                const rate = await this.rateJobService.rateJob(this.job);

                if (rate !== this.job.charge) {
                    await this.dispatchData.updateJobDetail(
                        this.job.id,
                        "rate",
                        Number(rate.replace(/[^0-9.-]+/g, "")),
                        Number(rate.replace(/[^0-9.-]+/g, "")),
                        this.dispatcherName,
                        this.contactId,
                        this.job.preBook
                    );
                }

                this.toastrService.showSuccessToast(`Pallet ${this.isEditing ? "updated" : "added"} successfully`);
            }
        } catch (error: any) {
            this.toastrService.showErrorToast(error.message);
        } finally {
            this.isLoading = false;
        }

        this.$mdDialog.hide();
    }

    cancel(): void {
        this.$mdDialog.cancel();
    }
}

app.controller("PalletDialogController", PalletDialogController);
