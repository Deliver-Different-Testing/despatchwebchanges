import {JobProperty} from "../../../enums/job-property.enum";

export interface JobOptions {
    detail: {
        size: Array<{ id: number; label: string }>;
        tracking: Array<{ id: number; label: string }>;
        DGClass: Array<{ id: number; label: string }>;
    }
}

export interface TabItem {
    id: number;
    text: string;
    isMainJob: boolean;
}

export interface CallData {
    field: JobProperty;
    value: string | Date | number | boolean;
    jobID: number;
}
