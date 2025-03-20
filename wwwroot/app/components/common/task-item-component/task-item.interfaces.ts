export interface ITaskListItemConfig {
    showJobId?: boolean;
    showAssignee?: boolean;
    showJobType?: boolean;
    showDateTime?: boolean;
    customClass?: string;
    showDescription?: boolean;
    maxDescriptionLength?: number;
    showStatusIndicators?: boolean;
    showPriorityIndicator?: boolean;
    allowCompletion?: boolean;
    showOverdueWarning?: boolean;
    dateFormat?: string;
    timeFormat?: string;
}
