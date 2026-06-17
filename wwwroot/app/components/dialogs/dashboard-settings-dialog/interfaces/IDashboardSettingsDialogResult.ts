import {ISuggestion} from "../../../../interfaces/job.interface";
import {IBox} from "../../../../interfaces/layout.interfaces";

interface ISettingsDialogResult {
    selectedRefreshInterval?: ISuggestion;
    selectedDriverLocationRefreshInterval?: ISuggestion;
    boxes?: Record<string, IBox>;
    aiEnabled?: boolean;
    /** Present when the dialog was opened with `showJobSearchBetaToggle: true`. */
    jobSearchBetaEnabled?: boolean;
}

export default ISettingsDialogResult;