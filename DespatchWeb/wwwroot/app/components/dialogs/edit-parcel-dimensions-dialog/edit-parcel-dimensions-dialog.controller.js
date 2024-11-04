/**
 * @fileoverview Controller for the edit parcel dimensions Dialog in the uDispatch application.
 * @module EditParcelDimensionsDialogController
 */

/**
 * Controller for the Edit Parcel Dimensions Dialog
 * @class
 */
class EditParcelDimensionsDialogController {
    // Update $inject to use 'dimensions' instead of 'parcelDimensions'
    static $inject = ['$mdDialog', 'toastrService', 'DispatchData', '$document', 'versionUrl', 'jobId', 'dimensions'];

    constructor($mdDialog, toastrService, DispatchData, $document, versionUrl, jobId, dimensions) {
        this._$mdDialog = $mdDialog;
        this._dispatchData = DispatchData;
        this._toastrService = toastrService;
        this._$document = $document;
        this._versionUrl = versionUrl;
        this._jobId = jobId;

        console.log('Initializing EditParcelDimensionsDialog with jobId:', jobId);
        console.log('Initial dimensions:', dimensions);

        /** @type {ParcelDimensions} */
        this.dimensions = {
            itemName: dimensions?.itemName || '',
            length: dimensions?.length || null,
            depth: dimensions?.depth || null,
            height: dimensions?.height || null,
            dimensions: dimensions?.dimensions || ''
        };

        console.log('Initialized dimensions:', this.dimensions);
        this.isLoading = false;
    }

    isValid() {
        const isValid = this.dimensions &&
            typeof this.dimensions.length === 'number' && this.dimensions.length > 0 &&
            typeof this.dimensions.depth === 'number' && this.dimensions.depth > 0 &&
            typeof this.dimensions.height === 'number' && this.dimensions.height > 0;

        console.log('Form validation result:', isValid, {
            length: this.dimensions?.length,
            depth: this.dimensions?.depth,
            height: this.dimensions?.height
        });

        return isValid;
    }

    _formatDimensions(dimensions) {
        if (dimensions.length && dimensions.depth && dimensions.height) {
            const formatted = `${this._formatNumber(dimensions.length)}x${this._formatNumber(dimensions.depth)}x${this._formatNumber(dimensions.height)}`;
            console.log('Formatted dimensions string:', formatted);
            return formatted;
        }
        console.log('Using existing dimensions string:', dimensions.dimensions);
        return dimensions.dimensions || '';
    }

    _formatNumber(value) {
        const formatted = value.toLocaleString('en-US', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 1
        });
        console.log(`Formatting number ${value} to ${formatted}`);
        return formatted;
    }

    cancel() {
        console.log('Dialog cancelled');
        this._$mdDialog.cancel();
    }

    async submit(dimensions) {
        console.log('Submit called with dimensions:', dimensions);

        // Show feature in development dialog
        await this._$mdDialog.show({
            controller: 'FeatureInDevelopmentDialogController',
            controllerAs: 'ctrl',
            templateUrl: this._versionUrl('app/components/dialogs/feature-in-development-dialog/feature-in-development-dialog.html'),
            parent: angular.element(this._$document.body),
            clickOutsideToClose: true,
            bindToController: true
        });
    }
}

angular.module('uDispatch')
    .controller('EditParcelDimensionsDialogController', EditParcelDimensionsDialogController);
