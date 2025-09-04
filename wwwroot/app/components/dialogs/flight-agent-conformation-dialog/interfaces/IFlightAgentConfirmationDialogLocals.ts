import {IFlightViewModel} from "../../../Nationwide/nationwide.interfaces";
import {ISuggestion} from "../../../../interfaces/job.interface";

interface IFlightAgentConfirmationDialogLocals {
    jobId: number;
    jobNumber: string;
    flight?: IFlightViewModel;
    agent?: ISuggestion;
    existingAwb?: string;
    dgClass?: number;
    stopJobCount?: number;
}

export default IFlightAgentConfirmationDialogLocals;