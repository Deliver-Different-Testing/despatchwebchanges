import {ISuggestion} from "../../../../interfaces/job.interface";

interface ISettingsDialogResult {
    selectedRefreshInterval?: ISuggestion;
    selectedDriverLocationRefreshInterval?: ISuggestion;
    nationwideBetaEnabled?: boolean;
}

export default ISettingsDialogResult;