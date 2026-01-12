/**
 * Job-related interfaces for React components
 */

export interface RelatedJobDto {
    id: number;
    text: string;
    selected: boolean;
}

export interface VoidJobRequest {
    jobId: number;
    voidSingleJobOnly: boolean;
    voidReason?: string;
    selectedJobIds?: number[];
}

export interface VoidBulkJobRequest {
    bulkJobId: number;
    voidSingleJobOnly: boolean;
    voidReason?: string;
    selectedJobIds?: number[];
}

export interface VoidJobDialogJob {
    id: number;
    jobNo: string;
    isBulkJob: boolean;
    isArchived?: boolean;
}

export interface VoidJobResult {
    success: boolean;
    voidedCount: number;
}

export interface RelatedJob {
    id: number;
    text: string;
    selected: boolean;
}
