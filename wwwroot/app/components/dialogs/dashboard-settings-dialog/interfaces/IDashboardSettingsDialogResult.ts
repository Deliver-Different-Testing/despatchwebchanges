import {ISuggestion} from "../../../../interfaces/job.interface";

interface ISettingsDialogResult {
    selectedRefreshInterval?: ISuggestion;
    selectedDriverLocationRefreshInterval?: ISuggestion;
}

export default ISettingsDialogResult;