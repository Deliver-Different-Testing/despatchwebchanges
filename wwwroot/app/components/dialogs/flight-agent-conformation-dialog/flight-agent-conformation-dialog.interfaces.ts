import {IFlightViewModel} from "../../Nationwide/nationwide.interfaces";
import {Suggestion} from "../../../interfaces/job.interface";

export interface IFlightAgentConfirmationDialogLocals {
    jobNumber: string;
    flight?: IFlightViewModel;
    agent?: Suggestion;
    existingAwb?: string;
    dgClass?: number;
}
