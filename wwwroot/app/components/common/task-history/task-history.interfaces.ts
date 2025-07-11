export interface IDeliveryHistoryConfig {
    showSummaryStats?: boolean;
    denseMode?: boolean;
    showFullToolbar: boolean;
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
