import {IFlightViewModel} from "../../../Nationwide/nationwide.interfaces";
import {Suggestion} from "../../../../interfaces/job.interface";

interface IFlightAgentConfirmationDialogLocals {
    jobId: number;
    jobNumber: string;
    flight?: IFlightViewModel;
    agent?: Suggestion;
    existingAwb?: string;
    dgClass?: number;
    stopJobCount?: number;
    toAirportId?: number;
}

export default IFlightAgentConfirmationDialogLocals;