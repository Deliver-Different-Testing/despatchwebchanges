import "./edit-parcel-dimensions-dialog.styles.less";
import ToastrService from "../../../services/toastr.service";
import DispatchCoreService from "../../../services/dispatch-core.service";
import {IParcelDimensions} from "../../../interfaces/job.interface";
import BaseController from "../../base-controller";
import {IAppConfig} from "../../../interfaces/app-config.interface";

class EditParcelDimensionsDialogController extends BaseController {
    static $inject = [
        "$mdDialog",
        "toastrService",
        "DispatchData",
        "APP_CONFIG",
        "parcels",
        "jobId",
        "bulkJobId",
    ];

    selectedParcelIndex: number = 0;
    isLoading: boolean = false;
    isParentJob: boolean = false;
    isFormDirty: boolean = false;
    
    dimensionsString: string;

    // Validation state
    validationErrors: { [key: string]: string } = {};

    // Constants for validation
    readonly MAX_DIMENSION: number = 999.9;
    readonly MAX_NAME_LENGTH: number = 50;

    constructor(
        private $mdDialog: angular.material.IDialogService,
        private toastrService: ToastrService,
        private DispatchData: DispatchCoreService,
        appConfig: IAppConfig,
        public parcels: IParcelDimensions[],
        private jobId?: number,
        private bulkJobId?: number,
    ) {
        super();
        
        this.dimensionsString = appConfig.US_Customer 
            ? "inches" 
            : "cm"
    }

    $onInit() {
        if (!this.parcels || this.parcels.length === 0) {
            this.parcels = [this.initializeParcel()];
        }

        if(this.jobId) {
            this.DispatchData.isJobParent(this.jobId).then((isParentJob: boolean) => {
                this.isParentJob = isParentJob;
            });
        } else if(this.bulkJobId) {
            this.DispatchData.isBulkJobParent(this.bulkJobId).then((isParentJob: boolean) => {
                this.isParentJob = isParentJob;
            });
        } else {
            this.toastrService.showErrorToast("No JobId or BulkJobId was provided. Something went wrong.");
            return;
        }
      
        this.parcels.forEach(parcel => {
            parcel.length = typeof parcel.length === 'number' ? parcel.length : undefined;
            parcel.depth = typeof parcel.depth === 'number' ? parcel.depth : undefined;
            parcel.height = typeof parcel.height === 'number' ? parcel.height : undefined;
        });
    }

    addNewParcel() {
        const newParcel = this.initializeParcel();
        this.parcels.push(newParcel);
        this.selectedParcelIndex = this.parcels.length - 1;
        this.isFormDirty = true;
    }

    private initializeParcel(): IParcelDimensions {
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

        this.parcels.splice(index, 1);

        if (this.parcels.length === 0) {
            this.parcels = [this.initializeParcel()];
            this.selectedParcelIndex = 0;
        } else if (index <= this.selectedParcelIndex) {
            this.selectedParcelIndex = Math.max(0, this.selectedParcelIndex - 1);
        }

        this.isFormDirty = true;
    }

    getCurrentParcel(): IParcelDimensions | null {
        return this.parcels[this.selectedParcelIndex] || null;
    }

    hasCurrentParcel(): boolean {
        return this.parcels.length > 0;
    }

    switchParcel(index: number) {
        if (index >= 0 && index < this.parcels.length) {
            this.selectedParcelIndex = index;
            this.validateCurrentParcel();
        }
    }

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
                // Skip validation if value is not provided (optional)
                if (value === undefined || value === null || value === '') {
                    return null;
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
    
    validateCurrentParcel(): boolean {
        const currentParcel = this.getCurrentParcel();
        if (!currentParcel) return false;

        this.validationErrors = {};

        const fields = ['itemName', 'length', 'depth', 'height'];
        let isValid = true;

        fields.forEach(field => {
            const error = this.validateField(field, currentParcel[field as keyof IParcelDimensions]);
            if (error) {
                this.validationErrors[field] = error;
                isValid = false;
            }
        });

        return isValid;
    }

    isValid(): boolean {
        return this.validateCurrentParcel();
    }

    getFieldError(fieldName: string): string | null {
        return this.validationErrors[fieldName] || null;
    }

    hasFieldError(fieldName: string): boolean {
        return !!this.validationErrors[fieldName];
    }

    cancel() {
        if (this.isFormDirty) {
            const userConfirmed = confirm('You have unsaved changes. Are you sure you want to discard them?');
            if (userConfirmed) {
                this.$mdDialog.cancel();
            }
        } else {
            this.$mdDialog.cancel();
        }
    }

    async submit() {
        if (!this.isValid()) {
            this.toastrService.showWarningToast('Please fix validation errors before saving');
            return;
        }

        this.isLoading = true;

        try {
            this.parcels.forEach(parcel => {
                // Only set dimensions string if all three values are provided
                if (parcel.length && parcel.depth && parcel.height) {
                    parcel.dimensions = `${parcel.length} × ${parcel.depth} × ${parcel.height} in`;
                } else {
                    parcel.dimensions = "";
                }
            });

            if(this.jobId) {
                await this.DispatchData.updatePackages(this.jobId, this.parcels);
            } else if(this.bulkJobId) {
                await this.DispatchData.updateBulkJobPackages(this.bulkJobId, this.parcels);
            } else {
                this.toastrService.showErrorToast("No JobId or BulkJobId was provided. Something went wrong.");
                return;
            }

            const count = this.parcels.length;
            this.toastrService.showSuccessToast(`Successfully updated ${count} ${count === 1 ? "parcel" : "parcels"}`);
            this.$mdDialog.hide(this.parcels);
        } catch (error: any) {
            console.error("An error occurred while updating packages:", error);
            this.toastrService.showErrorToast(error.message || 'Failed to update parcels');
        } finally {
            this.isLoading = false;
        }
    }

    updateFormState() {
        this.isFormDirty = true;
        this.validateCurrentParcel();
    }

    calculateVolume(): number {
        const parcel = this.getCurrentParcel();
        if (!parcel) return 0;

        const length = typeof parcel.length === 'number' ? parcel.length : 0;
        const depth = typeof parcel.depth === 'number' ? parcel.depth : 0;
        const height = typeof parcel.height === 'number' ? parcel.height : 0;

        return length * depth * height;
    }
}

export default EditParcelDimensionsDialogController
