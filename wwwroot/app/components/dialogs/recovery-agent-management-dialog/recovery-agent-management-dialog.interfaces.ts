import {AddressViewModel, Suggestion} from "../../../interfaces/job.interface";

export interface RecoveryAgentJobViewModel {
    jobId: number;
    jobNumber: string;
    assignedAgent: Suggestion;
    pickUpAddress: AddressViewModel;
    deliveryAddress: AddressViewModel;
    packageType: string;
    priority: string;
    lastKnownLocation: string;
    customer: string;
    recoveryJobs: RecoveryJobViewModel[];
}

export interface RecoveryJobViewModel {
    jobId: number;
    assignedAgent: Suggestion;
    recoveryAgents: RecoveryAgentViewModel[];
}

export interface RecoveryAgentViewModel {
    recoveryId: number;
    agentName: string;
    airport: string;
    primaryRecoveryAgent: boolean;
    assignStatus: string;
}

export interface AddAgentRecoveryRequest {
    jobId: number;
    agentId: number;
    airportId: number;
    isPrimaryRecoveryAgent: boolean;
}

export interface UpdateAgentRecoveryRequest {
    recoveryId: number;
    isPrimaryRecoveryAgent: boolean;
}

export interface RemoveAgentRecoveryRequest {
    recoveryId: number;
}