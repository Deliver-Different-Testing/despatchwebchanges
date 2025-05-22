import {JobProperty} from "../enums/job-property.enum";

export interface ISelectDialogResult {
    fieldName: JobProperty | string;
    value: any;
    checkboxValue?: boolean;
}

export interface IDialogDateTimeResult {
    fieldName: JobProperty;
    value: string;
    selectedTimeZoneId?: number;
}

export interface FlightAgentConfirmationDialogResult {
  shouldAssign: boolean;
  awb?: string;
}
