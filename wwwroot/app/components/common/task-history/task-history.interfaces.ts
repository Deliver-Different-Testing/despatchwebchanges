import DensityMode from "../../../enums/densityMode";

export interface IDeliveryHistoryConfig {
    showSummaryStats?: boolean;
    densityMode?: DensityMode;
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
