
export interface JobChangeRequestDto {
    id: number;
    jobId: number;
    partnerJobGuid?: string;
    pairingId?: number;
    sourceRequestUuid: string;
    tucEventId?: number;
    origin: string;
    requestingPartyType: string;
    approvalPartyType: string;
    fieldName: string;
    currentValue?: string;
    requestedValue?: string;
    reason?: string;
    status: string;
    approvalMode: string;
    ruleCode?: string;
    requiresCommercialRefresh: boolean;
    oldCommercialAmount?: number;
    newCommercialAmount?: number;
    requestedAt: string;
    respondedAt?: string;
    appliedAt?: string;
    rowVersion?: string;
}

export interface JobChangeRequestResult {
    success: boolean;
    message?: string;
    request?: JobChangeRequestDto;
    /**
     * Populated when the local row was saved but the IM enqueue/forward step
     * failed. The local state is consistent; the cross-tenant relay needs a
     * retry. The UI surfaces this as a non-blocking warning.
     */
    peerForwardWarning?: string;
}

export interface CreateJobChangeRequestPayload {
    jobId: number;
    fieldName: string;
    currentValue?: string;
    requestedValue?: string;
    reason?: string;
    /**
     * IntMgrPartnerPairing.Id that the job belongs to. Send this whenever the
     * frontend knows it (job.partnerPairingId) so the backend can resolve the
     * pairing on tenants with multiple active partner pairings without falling
     * back to the "single active pairing" heuristic.
     */
    pairingId?: number;
}

export interface DecisionPayload {
    requestId: number;
    rowVersion?: string;
    reason?: string;
}

/**
 * Approver-inbox row — Pending request the local tenant must review,
 * enriched with job context for the queue display.
 */
export interface JobChangeRequestInboxItem {
    request: JobChangeRequestDto;
    jobNo: string;
    clientName?: string;
}