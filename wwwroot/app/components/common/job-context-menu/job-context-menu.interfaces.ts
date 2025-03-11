import {Job, Suggestion} from "../../../interfaces/job.interface";

export interface MenuState {
    visible: boolean;
    position: {
        top: string | number;
        left: string | number;
    };
    currentJob: Job | null;
    eventGroups: Suggestion[];
}
