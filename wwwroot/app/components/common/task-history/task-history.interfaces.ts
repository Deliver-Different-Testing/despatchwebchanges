export interface ITaskHistoryConfig {
    showSummaryStats?: boolean;
    denseMode?: boolean;
    compactView?: boolean;
    customClass?: string;
}

export interface DeliveryJourneyViewModel {
    id: string;
    jobId: number;
    title: string;
    icon: string;
    description: string;
    date: string;
    tags: string[];
    status: string;
    notes: string;
}
