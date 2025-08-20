import {IFlightViewModel} from "../../../Nationwide/nationwide.interfaces";
import {Suggestion} from "../../../../interfaces/job.interface";

interface IFlightAgentConfirmationDialogLocals {
    jobNumber: string;
    flight?: IFlightViewModel;
    agent?: Suggestion;
    existingAwb?: string;
    dgClass?: number;
    stopJobCount?: number;
}

export default IFlightAgentConfirmationDialogLocals;