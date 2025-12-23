import './bulk-price-upload-dialog.styles.less';
import {
    PricingMode,
    BulkPricePreviewRow
} from "./bulk-price-upload-dialog.interfaces";
import DispatchCoreService from "../../../services/dispatch-core.service";
import ToastrService from "../../../services/toastr.service";
import BaseController from "../../base-controller";

type DialogState = 'upload' | 'mode-select' | 'result' | 'loading';

class BulkPriceUploadDialogController extends BaseController {
    static $inject = [
        '$mdDialog',
        '$timeout',
        '$interval',
        '$scope',
        'DispatchData',
        'toastrService'
    ];

    // State
    currentState: DialogState = 'upload';
    selectedMode: PricingMode = 'recalculate';

    // File handling
    uploadedFile: File | null = null;
    isDragOver: boolean = false;

    // Result data
    resultRows: BulkPricePreviewRow[] = [];
    filteredRows: BulkPricePreviewRow[] = [];
    searchTerm: string = '';

    // Summary
    totalJobs: number = 0;
    totalOldAmount: number = 0;
    totalNewAmount: number = 0;

    // Loading and errors
    isLoading: boolean = false;
    errorMessage: string = '';
    loadingMessage: string = '';

    constructor(
        private $mdDialog: angular.material.IDialogService,
        $timeout: angular.ITimeoutService,
        $interval: angular.IIntervalService,
        $scope: angular.IScope,
        private DispatchData: DispatchCoreService,
        private toastrService: ToastrService
    ) {
        super();
        this.initServices($timeout, $interval, $scope);
    }

    // File Upload Methods
    onDragOver(event: DragEvent): void {
        event.preventDefault();
        event.stopPropagation();
        this.isDragOver = true;
    }

    onDragLeave(event: DragEvent): void {
        event.preventDefault();
        event.stopPropagation();
        this.isDragOver = false;
    }

    onDrop(event: DragEvent): void {
        event.preventDefault();
        event.stopPropagation();
        this.isDragOver = false;

        const files = event.dataTransfer?.files;
        if (files && files.length > 0) {
            this.handleFileSelect(files[0]);
        }
    }

    triggerFileInput(): void {
        const input = document.getElementById('bulkPriceFileInput') as HTMLInputElement;
        input?.click();
    }

    onFileInputChange(event: Event): void {
        const input = event.target as HTMLInputElement;
        if (input.files && input.files.length > 0) {
            this.handleFileSelect(input.files[0]);
        }
    }

    handleFileSelect(file: File): void {
        const validExtensions = ['.xls', '.xlsx', '.csv'];
        const extension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

        if (!validExtensions.includes(extension)) {
            this.errorMessage = 'Invalid file format. Please upload an Excel (.xls, .xlsx) or CSV file.';
            this.applyScope();
            return;
        }

        this.uploadedFile = file;
        this.errorMessage = '';
        this.currentState = 'mode-select';
        this.applyScope();
    }

    // Mode Selection Methods
    selectMode(mode: PricingMode): void {
        this.selectedMode = mode;
    }

    getModeDescription(): string {
        switch (this.selectedMode) {
            case 'recalculate':
                return 'Prices will be recalculated based on job details and current rates';
            case 'base':
                return 'Raw base amounts from file will be saved directly';
            case 'gross':
                return 'Amounts from file will be applied directly as final prices';
            default:
                return '';
        }
    }

    getApplyButtonText(): string {
        switch (this.selectedMode) {
            case 'recalculate':
                return 'Recalculate & Save';
            case 'base':
                return 'Apply Raw Base Amounts';
            case 'gross':
                return 'Apply Gross Amounts';
            default:
                return 'Apply';
        }
    }

    async applyPrices(): Promise<void> {
        if (!this.uploadedFile) return;

        this.currentState = 'loading';
        this.isLoading = true;
        this.loadingMessage = 'Applying price changes...';
        this.errorMessage = '';

        try {
            const response = await this.DispatchData.applyBulkPriceUpdate(this.uploadedFile, this.selectedMode);

            this.resultRows = response.rows;
            this.filteredRows = [...this.resultRows];
            this.totalJobs = response.totalJobs;
            this.totalOldAmount = response.totalOldAmount;
            this.totalNewAmount = response.totalNewAmount;
            this.currentState = 'result';
            this.toastrService.showSuccessToast(`Successfully updated prices for ${this.totalJobs} jobs.`);
        } catch (error: any) {
            console.error('Error applying prices:', error);
            this.errorMessage = error?.data?.message || error?.message || 'Failed to apply prices. Please try again.';
            this.toastrService.showErrorToast(this.errorMessage);
            this.currentState = 'mode-select';
        } finally {
            this.isLoading = false;
            this.loadingMessage = '';
            this.applyScope();
        }
    }

    // Result Methods
    filterByJobNumber(): void {
        if (!this.searchTerm.trim()) {
            this.filteredRows = [...this.resultRows];
            return;
        }

        const search = this.searchTerm.toLowerCase().trim();
        this.filteredRows = this.resultRows.filter(row =>
            row.jobNo.toLowerCase().includes(search)
        );
    }

    getAmountChange(): number {
        return this.totalNewAmount - this.totalOldAmount;
    }

    getAmountChangeClass(): string {
        const change = this.getAmountChange();
        if (change > 0) return 'increase';
        if (change < 0) return 'decrease';
        return 'no-change';
    }

    // Navigation Methods
    backToUpload(): void {
        this.uploadedFile = null;
        this.resultRows = [];
        this.filteredRows = [];
        this.searchTerm = '';
        this.errorMessage = '';
        this.currentState = 'upload';
    }

    backToModeSelect(): void {
        this.resultRows = [];
        this.filteredRows = [];
        this.searchTerm = '';
        this.errorMessage = '';
        this.currentState = 'mode-select';
    }

    done(): void {
        this.$mdDialog.hide(true);
    }

    cancel(): void {
        this.$mdDialog.cancel();
    }
}

export default BulkPriceUploadDialogController;
