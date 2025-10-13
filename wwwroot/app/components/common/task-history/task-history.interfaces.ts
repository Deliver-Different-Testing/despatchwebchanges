import DensityMode from "../../../enums/densityMode";
import {Dayjs} from "dayjs";

export interface IDeliveryHistoryConfig {
    showSummaryStats?: boolean;
    densityMode?: DensityMode;
}

export interface IDeliveryJourney {
    id: string;
    jobId: number;
    title: string;
    icon: string;
    description: string;
    date: Dayjs;
    tags: string[];
    status: string;
    notes: string;
}

export interface IDeliveryJourneyDto {
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
