export type PricingMode = 'recalculate' | 'base' | 'gross';

export interface BulkPricePreviewRow {
    jobId: number;
    jobNo: string;
    field: string;
    oldAmount: number;
    newAmount: number;
    isPrebook: boolean;
    error?: string;
}

export interface BulkPricePreviewResponse {
    rows: BulkPricePreviewRow[];
    totalJobs: number;
    totalOldAmount: number;
    totalNewAmount: number;
}
