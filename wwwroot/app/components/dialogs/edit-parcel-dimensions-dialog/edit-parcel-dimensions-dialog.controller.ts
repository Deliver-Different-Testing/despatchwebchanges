import "./edit-parcel-dimensions-dialog.styles.less";
import ToastrService from "../../../services/toastr.service";
import DispatchCoreService from "../../../services/dispatch-core.service";
import {ParcelDimensions} from "../../../interfaces/job.interface";
import BaseController from "../../base-controller";

export class EditParcelDimensionsDialogController extends BaseController {
    static $inject = [
        "$mdDialog",
        "toastrService",
        "DispatchData",
        "jobId",
        "parcels"
    ];

    selectedParcelIndex: number = 0;
    isLoading: boolean = false;
    isParentJob: boolean = false;
    isFormDirty: boolean = false;

    // Validation state
    validationErrors: { [key: string]: string } = {};

    // Constants for validation
    readonly MAX_DIMENSION: number = 999.9;
    readonly MAX_NAME_LENGTH: number = 50;

    constructor(
        private $mdDialog: angular.material.IDialogService,
        private toastrService: ToastrService,
        private DispatchData: DispatchCoreService,
        public jobId: number,
        public parcels: ParcelDimensions[]
    ) {
        super();
    }

    $onInit() {
        // Initialize with at least one parcel if array is empty
        if (!this.parcels || this.parcels.length === 0) {
            this.parcels = [this._initializeParcel()];
        }

        // Check if this is a parent job
        this.DispatchData.isJobParent(this.jobId).then(isParentJob => {
            this.isParentJob = isParentJob;
        });

        // Set initial state for all parcels
        this.parcels.forEach(parcel => {
            // Ensure dimensions are handled as numbers
            parcel.length = typeof parcel.length === 'number' ? parcel.length : undefined;
            parcel.depth = typeof parcel.depth === 'number' ? parcel.depth : undefined;
            parcel.height = typeof parcel.height === 'number' ? parcel.height : undefined;
        });
    }

    addNewParcel() {
        const newParcel = this._initializeParcel();
        this.parcels.push(newParcel);
        this.selectedParcelIndex = this.parcels.length - 1;
        this.isFormDirty = true;
    }

    private _initializeParcel(): ParcelDimensions {
        return {
            itemName: "",
            length: undefined,
            depth: undefined,
            height: undefined,
            dimensions: "",
        };
    }

    deleteParcel(index: number, $event?: Event) {
        if ($event) {
            $event.stopPropagation();
        }

        // Remove the parcel
        this.parcels.splice(index, 1);

        // Always ensure we have at least one parcel
        if (this.parcels.length === 0) {
            this.parcels = [this._initializeParcel()];
            this.selectedParcelIndex = 0;
        } else if (index <= this.selectedParcelIndex) {
            this.selectedParcelIndex = Math.max(0, this.selectedParcelIndex - 1);
        }

        this.isFormDirty = true;
    }

    getCurrentParcel(): ParcelDimensions | null {
        return this.parcels[this.selectedParcelIndex] || null;
    }

    hasCurrentParcel(): boolean {
        return this.parcels.length > 0;
    }

    switchParcel(index: number) {
        if (index >= 0 && index < this.parcels.length) {
            this.selectedParcelIndex = index;
            this.validateCurrentParcel(); // Validate when switching parcels
        }
    }

    // Validate each field individually
    validateField(fieldName: string, value: any): string | null {
        switch (fieldName) {
            case 'itemName':
                if (value && value.length > this.MAX_NAME_LENGTH) {
                    return `Name must be ${this.MAX_NAME_LENGTH} characters or less`;
                }
                return null;

            case 'length':
            case 'depth':
            case 'height':
                if (value === undefined || value === null || value === '') {
                    return `${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)} is required`;
                }
                if (typeof value !== 'number' || isNaN(value)) {
                    return `${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)} must be a number`;
                }
                if (value <= 0) {
                    return `${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)} must be greater than 0`;
                }
                if (value > this.MAX_DIMENSION) {
                    return `${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)} must be ${this.MAX_DIMENSION} or less`;
                }
                return null;

            default:
                return null;
        }
    }

    // Validate the current parcel
    validateCurrentParcel(): boolean {
        const currentParcel = this.getCurrentParcel();
        if (!currentParcel) return false;

        this.validationErrors = {}; // Reset errors

        // Validate each field
        const fields = ['itemName', 'length', 'depth', 'height'];
        let isValid = true;

        fields.forEach(field => {
            const error = this.validateField(field, currentParcel[field as keyof ParcelDimensions]);
            if (error) {
                this.validationErrors[field] = error;
                isValid = false;
            }
        });

        return isValid;
    }

    // Check if all parcels are valid
    isValid(): boolean {
        // First validate current parcel
        const currentIsValid = this.validateCurrentParcel();

        // Quick check of required dimensions for all parcels
        const allParcelsValid = this.parcels.every(parcel => {
            return typeof parcel.length === 'number' && parcel.length > 0 &&
                typeof parcel.depth === 'number' && parcel.depth > 0 &&
                typeof parcel.height === 'number' && parcel.height > 0;
        });

        return currentIsValid && allParcelsValid;
    }

    // Get field error message
    getFieldError(fieldName: string): string | null {
        return this.validationErrors[fieldName] || null;
    }

    // Check if field has error
    hasFieldError(fieldName: string): boolean {
        return !!this.validationErrors[fieldName];
    }

    cancel() {
        // If form is dirty (has changes), show confirmation dialog
        if (this.isFormDirty) {
            const confirm = this.$mdDialog.confirm()
                .title('Discard Changes?')
                .textContent('You have unsaved changes. Are you sure you want to discard them?')
                .ariaLabel('Discard changes confirmation')
                .ok('Yes, Discard')
                .cancel('No, Continue Editing');

            this.$mdDialog.show(confirm).then(() => {
                this.$mdDialog.cancel();
            });
        } else {
            this.$mdDialog.cancel();
        }
    }

    async submit() {
        if (!this.isValid()) {
            this.toastrService.showErrorToast('Please fix validation errors before saving');
            return;
        }

        this.isLoading = true;

        try {
            // Format the dimensions string for each parcel before saving
            this.parcels.forEach(parcel => {
                // Format dimensions string (e.g., "12 × 10 × 8 in")
                if (parcel.length && parcel.depth && parcel.height) {
                    parcel.dimensions = `${parcel.length} × ${parcel.depth} × ${parcel.height} in`;
                }
            });

            await this.DispatchData.updatePackages(this.jobId, this.parcels);

            // Success message and close
            const count = this.parcels.length;
            this.toastrService.showSuccessToast(`Successfully updated ${count} ${count === 1 ? "parcel" : "parcels"}`);
            this.$mdDialog.hide(this.parcels); // Return updated parcels
        } catch (error: any) {
            console.error("An error occurred while updating packages:", error);
            this.toastrService.showErrorToast(error.message || 'Failed to update parcels');
        } finally {
            this.isLoading = false;
        }
    }

    // Track when the form becomes dirty
    updateFormState() {
        this.isFormDirty = true;
        this.validateCurrentParcel();
    }

    // Calculate volume of current parcel
    calculateVolume(): number {
        const parcel = this.getCurrentParcel();
        if (!parcel) return 0;

        const length = typeof parcel.length === 'number' ? parcel.length : 0;
        const depth = typeof parcel.depth === 'number' ? parcel.depth : 0;
        const height = typeof parcel.height === 'number' ? parcel.height : 0;

        return length * depth * height;
    }
}
