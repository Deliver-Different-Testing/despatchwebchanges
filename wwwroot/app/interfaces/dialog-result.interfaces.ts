import {JobProperty} from "../enums/job-property.enum";
import {Dayjs} from "dayjs";


interface IDialogResult {
    fieldName: JobProperty | string;
    value: any;
}

export interface ISelectDialogResult extends IDialogResult {
    checkboxValue?: boolean;
}

export interface IDialogDateTimeResult extends IDialogResult {
    timezone: string;
}

export interface FlightAgentConfirmationDialogResult {
    shouldAssign?: boolean;
    awb?: string;
    shouldAssignToStopJobs?: boolean;
    overrideDeliverByTime?: boolean;
    packageReadyTime?: Dayjs;
    packageDeliverByTime?: Dayjs;
    packageDeliveryNotes?: string;
}
