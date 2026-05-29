/**
 * Shared types for DispatchDialog.
 *
 * The dialog routes a job (single or bulk) to one of four destinations:
 * Courier / Agent / NP / DFRNT Partner. DFRNT Partner folds in the
 * rate-determination flow from the old SendToPartnerDialog.
 */

import type {PartnerRateForJobResponse, EventGroupItem} from '../../../services/jobListApi';
import type {ISuggestion} from '../../../../interfaces/job.interface';

export type DispatchType = 'Courier' | 'Agent' | 'NP' | 'DfrntPartner';

/** Flags that decide whether DFRNT Partner is viable for the current job. */
export interface DispatchJobFlags {
    isArchived: boolean;
    isBulkJob: boolean;
    preBook: boolean;
}

export type DispatchMode =
    /** Standard active or archived TucJob — dispatcher picks a destination from any type. */
    | {kind: 'single'; jobId: number; jobNo: string; flags: DispatchJobFlags}
    /** Multiple jobs selected from the toolbar — DFRNT Partner is unavailable. */
    | {kind: 'bulk'; jobs: Array<{id: number; jobNo: string}>}
    /** Recurring job booking template — writes to CourierID / AgentId / NpAgentId; DFRNT Partner unavailable. */
    | {kind: 'recurring'; jobId: number; jobNo: string};

export interface DispatchDialogProps {
    open: boolean;
    mode: DispatchMode;
    /** Optional pre-selected radio. Defaults to 'Courier'. */
    initialType?: DispatchType;
    /** Initial value shown in the destination Autocomplete (used to render the current courier/agent on the row). */
    existingDestination?: ISuggestion;
    onClose: () => void;
    /** Called when the operator picks a Courier / Agent / NP. Implementation decides what API to call. */
    onDispatchCourier: (type: 'Courier' | 'Agent' | 'NP', destination: ISuggestion) => Promise<void>;
    /** Called when the operator picks a partner + sets a rate. */
    onSendToPartner: (partner: ISuggestion, agreedRate: number) => Promise<void>;
    /** Loads the rate for a (pairingId, jobId) pair. Required when DFRNT Partner is enabled. */
    fetchRate: (pairingId: number, jobId: number) => Promise<PartnerRateForJobResponse>;
    /** Loads the list of active partners. Required when DFRNT Partner is enabled. */
    getPartnerOptions: () => Promise<EventGroupItem[]>;
}
