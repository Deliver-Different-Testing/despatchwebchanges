import "./edit-parcel-dimensions-dialog.styles.less";

/**
 * Controller for the Edit Parcel Dimensions Dialog
 * Manages the editing of parcel dimensions including adding, deleting, and updating parcels
 */
class EditParcelDimensionsDialogController {
    /** @type {string[]} Angular dependency injection array */
    static $inject = ["$mdDialog", "toastrService", "DispatchData", "$document", "jobId", "parcels",];

    /**
     * Creates an instance of EditParcelDimensionsDialogController
     * @param {Object} $mdDialog - Angular Material Dialog service
     * @param {Object} toastrService - Toast notification service
     * @param {Object} DispatchData - Service for handling dispatch data
     * @param {Object} $document - Angular document service
     * @param {number} jobId - ID of the current job
     * @param {ParcelDimensions[]} parcels - Array of parcels to edit
     */
    constructor($mdDialog, toastrService, DispatchData, $document, jobId, parcels) {
        this.$mdDialog = $mdDialog;
        this.dispatchData = DispatchData;
        this.toastrService = toastrService;
        this.$document = $document;
        this.jobId = jobId;

        // Initialize with empty array if no parcels provided
        this.parcels = parcels?.length ? [...parcels] : [];
        this.selectedParcelIndex = 0;

        console.log("Initializing EditParcelDimensionsDialog with jobId:", jobId);
        console.log("Initial parcels:", this.parcels);
        this.isLoading = false;
    }

    /**
     * Creates a new empty parcel object with default values
     * @returns {ParcelDimensions} New parcel object with default values
     * @private
     */
    _initializeParcel() {
        return {
            itemName: "", length: null, depth: null, height: null, dimensions: "",
        };
    }

    /**
     * Adds a new empty parcel to the list and selects it
     */
    addNewParcel() {
        const newParcel = this._initializeParcel();
        this.parcels.push(newParcel);
        this.selectedParcelIndex = this.parcels.length - 1;
    }

    /**
     * Deletes a parcel from the list and updates selection
     * @param {number} index - Index of the parcel to delete
     * @param {Event} [$event] - Optional event object to stop propagation
     */
    deleteParcel(index, $event) {
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

    /**
     * Gets the currently selected parcel
     * @returns {ParcelDimensions|null} The current parcel or null if none selected
     */
    getCurrentParcel() {
        return this.parcels[this.selectedParcelIndex] || null;
    }

    /**
     * Checks if there is at least one parcel in the list
     * @returns {boolean} True if there is at least one parcel
     */
    hasCurrentParcel() {
        return this.parcels.length > 0;
    }

    /**
     * Switches the selected parcel to the one at the specified index
     * @param {number} index - Index of the parcel to select
     */
    switchParcel(index) {
        console.log(`Switching to parcel ${index}`);
        if (index >= 0 && index < this.parcels.length) {
            this.selectedParcelIndex = index;
        }
    }

    /**
     * Validates the current parcel's dimensions
     * @returns {boolean} True if all dimensions are valid numbers greater than 0
     */
    isValid() {
        const currentParcel = this.getCurrentParcel();
        if (!currentParcel) return false;

        const isValid = typeof currentParcel.length === "number" && currentParcel.length > 0 && typeof currentParcel.depth === "number" && currentParcel.depth > 0 && typeof currentParcel.height === "number" && currentParcel.height > 0;

        console.log("Form validation result:", isValid, {
            length: currentParcel?.length, depth: currentParcel?.depth, height: currentParcel?.height,
        });

        return isValid;
    }

    /**
     * Formats a number to a localized string with at most 1 decimal place
     * @param {number} value - Number to format
     * @returns {string} Formatted number string
     * @private
     */
    _formatNumber(value) {
        const formatted = value.toLocaleString("en-US", {
            minimumFractionDigits: 0, maximumFractionDigits: 1,
        });

        console.log(`Formatting number ${value} to ${formatted}`);
        return formatted;
    }

    /**
     * Cancels the dialog without saving changes
     */
    cancel() {
        console.log("Dialog cancelled");
        this.$mdDialog.cancel();
    }

    /**
     * Submits the updated parcels to the server
     * @returns {Promise<void>} Promise that resolves when the update is complete
     */
    async submit() {
        console.log("Submit called with parcels:", this.parcels);

        try {
            await this.dispatchData.updatePackages(this.jobId, this.parcels);

            // Success message and close
            const count = this.parcels.length;
            this.toastrService.showSuccessToast(`Successfully ${count} ${count === 1 ? 'parcel' : 'parcels'} updated`);
            this.$mdDialog.hide();
        } catch (error) {
            console.error("An error occured while updating packages:", error);
            this.toastrService.showErrorToast(error.message);
        }
    }
}

angular
    .module("uDispatch")
    .controller("EditParcelDimensionsDialogController", EditParcelDimensionsDialogController);
