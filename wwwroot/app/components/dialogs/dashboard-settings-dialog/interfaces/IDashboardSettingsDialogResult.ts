import {ISuggestion} from "../../../../interfaces/job.interface";

interface ISettingsDialogResult {
    selectedRefreshInterval?: ISuggestion;
    selectedDriverLocationRefreshInterval?: ISuggestion;
    aiEnabled?: boolean;
    nationwideBetaEnabled?: boolean;
}

export default ISettingsDialogResult;