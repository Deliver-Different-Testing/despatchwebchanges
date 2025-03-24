import "./edit-parcel-dimensions-dialog.styles.less";
import ToastrService from "../../../services/toastr.service";
import DispatchCoreService from "../../../services/dispatch-core.service";
import {ParcelDimensions} from "../../../interfaces/job.interface";
import app from "../../../app";

export class EditParcelDimensionsDialogController {
    static $inject = ["$mdDialog", "toastrService", "DispatchData", "jobId", "parcels"];

    selectedParcelIndex: number;
    isLoading: boolean;

    constructor(
        private $mdDialog: angular.material.IDialogService,
        private toastrService: ToastrService,
        private DispatchData: DispatchCoreService,
        public jobId: number,
        public parcels: ParcelDimensions[]
    ) {
        // Initialize with empty array if no parcels provided
        this.selectedParcelIndex = 0;

        console.log("Initializing EditParcelDimensionsDialog with jobId:", jobId);
        console.log("Initial parcels:", this.parcels);
        this.isLoading = false;
    }

    private initializeParcel(): ParcelDimensions {
        return {
            itemName: "",
            length: undefined,
            depth: undefined,
            height: undefined,
            dimensions: "",
        };
    }

    addNewParcel(): void {
        const newParcel = this.initializeParcel();
        this.parcels.push(newParcel);
        this.selectedParcelIndex = this.parcels.length - 1;
    }

    deleteParcel(index: number, $event?: Event): void {
        if ($event) {
            $event.stopPropagation();
        }

        // Remove the parcel
        this.parcels.splice(index, 1);

        if (this.parcels.length === 0) {
            this.selectedParcelIndex = 0;
        } else if (index <= this.selectedParcelIndex) {
            this.selectedParcelIndex = Math.max(0, this.selectedParcelIndex - 1);
        }
    }

    getCurrentParcel(): ParcelDimensions | null {
        return this.parcels[this.selectedParcelIndex] || null;
    }

    hasCurrentParcel(): boolean {
        return this.parcels.length > 0;
    }

    switchParcel(index: number): void {
        console.log(`Switching to parcel ${index}`);
        if (index >= 0 && index < this.parcels.length) {
            this.selectedParcelIndex = index;
        }
    }

    isValid(): boolean {
        const currentParcel = this.getCurrentParcel();
        if (!currentParcel) return false;

        const isValid =
            typeof currentParcel.length === "number" &&
            currentParcel.length > 0 &&
            typeof currentParcel.depth === "number" &&
            currentParcel.depth > 0 &&
            typeof currentParcel.height === "number" &&
            currentParcel.height > 0;

        console.log("Form validation result:", isValid, {
            length: currentParcel?.length,
            depth: currentParcel?.depth,
            height: currentParcel?.height,
        });

        return isValid;
    }

    cancel(): void {
        console.log("Dialog cancelled");
        this.$mdDialog.cancel();
    }


    async submit(): Promise<void> {
        console.log("Submit called with parcels:", this.parcels);

        try {
            await this.DispatchData.updatePackages(this.jobId, this.parcels);

            // Success message and close
            const count = this.parcels.length;
            this.toastrService.showSuccessToast(`Successfully ${count} ${count === 1 ? "parcel" : "parcels"} updated`);
            this.$mdDialog.hide();
        } catch (error: any) {
            console.error("An error occured while updating packages:", error);
            this.toastrService.showErrorToast(error.message);
        }
    }
}
