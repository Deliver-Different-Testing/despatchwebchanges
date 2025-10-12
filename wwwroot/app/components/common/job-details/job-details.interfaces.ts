import {JobProperty} from "../../../enums/job-property.enum";
import {ISuggestion} from "../../../interfaces/job.interface";

export interface TabItem extends ISuggestion {
    isMainJob: boolean;
}

export interface CallData {
    field: JobProperty;
    value: string | Date | number | boolean;
    jobID: number;
}
