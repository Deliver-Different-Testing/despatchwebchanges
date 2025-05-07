import {JobProperty} from "../enums/job-property.enum";
import {TimeZoneSuggestion} from "./job.interface";

export interface ISelectDialogResult {
    fieldName: JobProperty;
    value: any;
    checkboxValue?: boolean;
}

export interface IDialogDateTimeResult {
    fieldName: string;
    value: Date;
    selectedTimeZone?: TimeZoneSuggestion;
}
