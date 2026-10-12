import type {PartnerRateForJobResponse} from "../../../services/jobListApi";

export interface PartnerRatePanelProps {
    partnerId: number;
    jobId: number;
    fetchRate: (pairingId: number, jobId: number) => Promise<PartnerRateForJobResponse>;
    /** Called whenever the operator-chosen rate or its validity changes. */
    onRateChange: (rate: number, valid: boolean) => void;
    /** Disables the rate input (used while the parent submits). */
    disabled?: boolean;
    /**
     * Fires when the partner conclusively reports it cannot carry this route, so the parent can
     * reframe its confirm button as "Send anyway". Never fires true for an unreachable partner.
     */
    onServiceabilityChange?: (unserviceable: boolean) => void;
}