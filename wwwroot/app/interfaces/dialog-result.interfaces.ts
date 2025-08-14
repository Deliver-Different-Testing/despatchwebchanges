import {JobProperty} from "../enums/job-property.enum";


interface IDialogResult {
    fieldName: JobProperty | string;
    value: any;
}

export interface ISelectDialogResult extends IDialogResult {
    checkboxValue?: boolean;
}

export interface IDialogDateTimeResult extends IDialogResult {
    // Add additional parameters here if needed
}

export interface FlightAgentConfirmationDialogResult {
    shouldAssign?: boolean;
    awb?: string;
    shouldAssignToStopJobs?: boolean;
}
