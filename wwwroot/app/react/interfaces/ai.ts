import {SummarySeverity, TimelineStatus} from "../services/aiAssistantApi";
import {Suggestion} from "./job";

export interface AiUsageInfo {
    inputTokens: number;
    outputTokens: number;
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


// ---------------------------------------------------------------------------
//  Intake — turn operator-supplied free text into structured form input.
//  Neither of these acts on its own output: the operator reviews and submits.
// ---------------------------------------------------------------------------

/**
 * A name Auto-mate read out of the source, and the record the server matched it to.
 * `id` is null when nothing matched — the operator picks it rather than the model
 * inventing one.
 */
export interface AiResolvedLookup {
    text: string | null;
    id: number | null;
    name: string | null;
}

/** The eight numbered lines, meaning what they mean on this tenant. */
export interface AiIntakeAddress {
    addressLine1: string;
    addressLine2: string;
    addressLine3: string;
    addressLine4: string;
    addressLine5: string;
    addressLine6: string;
    addressLine7: string;
    addressLine8: string;
}

export interface JobIntakeResponse {
    pickupAddress: AiIntakeAddress;
    deliveryAddress: AiIntakeAddress;
    client: AiResolvedLookup;
    speed: AiResolvedLookup;
    vehicle: AiResolvedLookup;
    fromContactName: string;
    deliverToContact: string;
    podName: string;
    /** ISO yyyy-MM-dd, or null when the source named no date. */
    date: string | null;
    refA: string;
    refB: string;
    pickupNotes: string;
    deliveryNotes: string;
    jobNotes: string;
    weight: number | null;
    weightUnit: 'kg' | 'lb' | null;
    confidence: number;
    /** What a human still has to decide. Shown first. */
    unresolved: string[];
    usage: AiUsageInfo;
}

export interface ExtractJobIntakeRequest {
    text: string;
}

export interface AiIgnoredTerm {
    term: string;
    reason: string;
}

export interface SearchCriteriaResponse {
    clients: Suggestion[];
    couriers: Suggestion[];
    speeds: Suggestion[];
    jobId: number | null;
    bulkJobId: number | null;
    jobNumber: string | null;
    wildcard: string | null;
    fromDate: string | null;
    toDate: string | null;
    ignored: AiIgnoredTerm[];
    /** Names no client, courier or speed matched — shown so nothing is silently dropped. */
    unmatchedNames: string[];
    usage: AiUsageInfo;
}

export interface ParseSearchQueryRequest {
    query: string;
}

// ---------------------------------------------------------------------------
//  Inbox triage and price explanation.
// ---------------------------------------------------------------------------

export type MessageIntent =
    | 'JobQuery' | 'StatusUpdate' | 'Problem' | 'Availability' | 'Pay' | 'Admin' | 'Other';

export type MessageUrgency = 'Critical' | 'Urgent' | 'Soon' | 'Routine';

export interface InboxTriageItem {
    otherPartyId: number;
    /** 0 = Courier, 1 = Staff — matches OtherMessagePartyType on the server. */
    otherPartyType: number;
    intent: MessageIntent;
    urgency: MessageUrgency;
    summary: string;
    jobReferences: string[];
    suggestedResponseId: number | null;
}

export interface InboxTriageResponse {
    conversations: InboxTriageItem[];
    usage: AiUsageInfo;
}

export interface PriceExplanationLine {
    name: string;
    amount: number;
    explanation: string;
}

export interface PriceQueryRisk {
    component: string;
    evidence: string;
}

export interface PriceExplanationResponse {
    headline: string;
    lines: PriceExplanationLine[];
    queryRisks: PriceQueryRisk[];
    caveats: string[];
    usage: AiUsageInfo;
}
