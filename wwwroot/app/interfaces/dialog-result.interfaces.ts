export interface ISelectDialogResult {
    fieldName: string;
    value: any;
    checkboxValue?: boolean;
}

export interface IDialogDateTimeResult {
    fieldName: string;
    value: string;
    formattedDateTime: string;
}
