import {SummarySeverity, TimelineStatus} from "../services/aiAssistantApi";

export interface AiUsageInfo {
    inputTokens: number;
    outputTokens: number;
}

export interface AiSummaryResponse {
    summary: string;
    usage: AiUsageInfo;
}

export interface AttentionItem {
    headline: string;
    action: string;
    severity: SummarySeverity;
}

export interface TimelineItem {
    label: string;
    detail: string;
    status: TimelineStatus;
}

export interface StructuredSummaryResponse {
    verdict: string;
    severity: SummarySeverity;
    keyFacts: string[];
    attention: AttentionItem[];
    timeline: TimelineItem[];
    highlights: string[];
    usage: AiUsageInfo;
}


/** Body-only AI draft (courier/staff message, job note). */
export interface AiDraftResponse {
    draft: string;
    usage: AiUsageInfo;
}

/** Subject + body AI draft (POD delivery email, compose email). */
export interface AiEmailDraftResponse {
    subject: string;
    body: string;
    usage: AiUsageInfo;
}

export interface DraftMessageRequest {
    recipientName: string;
    /** 0 = Courier, 1 = Staff (OtherMessagePartyType). */
    recipientType: number;
    /** 1 = App, 2 = SMS, 3 = Smart. */
    messageType: number;
    /** Rough text the user typed; may be empty. */
    seed: string;
    /** Optional recent thread lines (oldest first). */
    recentMessages?: string[];
    jobId?: number;
}

export interface DraftEmailRequest {
    recipientNames: string[];
    seedSubject: string;
    seedBody: string;
}

export interface DraftNoteRequest {
    jobId?: number;
    jobBookingId?: number;
    bulkJobId?: number;
    /** NoteType enum value — drives audience/tone. */
    noteTypeId: number;
    seed: string;
}


// ---------------------------------------------------------------------------
//  Insights — read existing data and surface structured analysis.
// ---------------------------------------------------------------------------

export interface BlockerItem {
    tag: string;
    severity: SummarySeverity;
    evidence: string;
    actionRequired: boolean;
}

export interface ExtractBlockersResponse {
    blockers: BlockerItem[];
    summary: string;
    severity: SummarySeverity;
    usage: AiUsageInfo;
}

export interface AccessorialSuggestion {
    accessorialChargeId: number;
    name: string;
    reason: string;
    suggestedInputValue?: number | null;
}

export interface PricingAnomaly {
    storedCharge: number;
    recomputedRate: number;
    deltaPercent: number;
    isOutlier: boolean;
}

export interface PricingAnalysisResponse {
    anomaly: PricingAnomaly | null;
    suggestions: AccessorialSuggestion[];
    usage: AiUsageInfo;
}

export interface ChangeRequestTriageResponse {
    /** "approve" | "reject" | "clarify" — advisory only. */
    recommendedAction: string;
    confidence: number;
    rationale: string;
    riskFactors: string[];
    usage: AiUsageInfo;
}