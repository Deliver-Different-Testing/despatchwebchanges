import {ISuggestion} from "../../../../interfaces/job.interface";

interface ISettingsDialogResult {
    selectedRefreshInterval?: ISuggestion;
    selectedDriverLocationRefreshInterval?: ISuggestion;
    aiEnabled?: boolean;
    /** Present when the dialog was opened with `showJobSearchBetaToggle: true`. */
    jobSearchBetaEnabled?: boolean;
    /** Present when the dialog was opened with `showDispatchBetaToggle: true`. */
    dispatchBetaEnabled?: boolean;
    nationwideBetaEnabled?: boolean;
}

export default ISettingsDialogResult;