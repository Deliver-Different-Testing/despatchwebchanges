import {JobProperty} from "../enums/job-property.enum";

export interface ISelectDialogResult {
    fieldName: JobProperty;
    value: any;
    checkboxValue?: boolean;
}

export interface IDialogDateTimeResult {
    fieldName: JobProperty | string;
    value: Date;
    formattedDateTime: string;
}
