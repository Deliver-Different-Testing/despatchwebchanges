import {ISuggestion} from "../../../../interfaces/job.interface";
import {IBox} from "../../../../interfaces/layout.interfaces";

interface ISettingsDialogResult {
    selectedRefreshInterval?: ISuggestion;
    boxes?: Record<string, IBox>;
}

export default ISettingsDialogResult;