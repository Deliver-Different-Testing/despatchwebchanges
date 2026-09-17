import {AddressViewModel} from "../interfaces";
import {apiClient} from "../services/apiClient";
import {SplitPricingBasis} from "../services/splitJobApi";

/**
 * One leg's confirmed share of the parent total. Shares are sent rather than per-line amounts so
 * the server stays the single source of truth for rounding.
 */
export interface SplitPricingAllocationItem {
    sequence: number;
    sharePercent: number;
}


/**
 * One leg's confirmed share of a single breakdown line, for a charge that shouldn't follow the
 * overall split — a congestion charge only one leg's route incurred, for example.
 */
export interface SplitPricingLineAllocationItem {
    /** The parent breakdown line this override applies to; 0 for the synthesised line. */
    pricingBreakdownId: number;
    sequence: number;
    sharePercent: number;
    /** This leg's cost for this line, set directly rather than derived from sharePercent. */
    costOverride?: number;
}

/**
 * Request model for splitting a job with a meeting point address.
 */
export interface SplitJobRequest {
    jobId: number;
    meetingPointAddress: AddressViewModel;
    courierIdForLegB?: number | null;
    /** Omitted for callers that don't confirm pricing — the server then derives the split itself. */
    pricingAllocation?: SplitPricingAllocationItem[] | null;
    /** Only the lines the user adjusted; every other line follows `pricingAllocation`. */
    lineAllocation?: SplitPricingLineAllocationItem[] | null;
}


export interface SplitPricingLine {
    /** The parent line this was divided out of; 0 for the synthesised line. */
    pricingBreakdownId: number;
    name: string;
    revenue: number;
    cost: number;
}

/** One of the parent's lines, before it is divided — what a per-line share is set against. */
export interface SplitPricingParentLine {
    pricingBreakdownId: number;
    /** The original charge name, without a "Part {suffix}". */
    name: string;
    revenue: number;
    cost: number;
    isAccessorial: boolean;
}

export interface SplitPricingLeg {
    sequence: number;
    letterSuffix: string;
    jobNumber: string;
    /** In the preview's `distanceUnit`. Zero when no distance could be determined. */
    distance: number;
    sharePercent: number;
    totalRevenue: number;
    totalCost: number;
    lines: SplitPricingLine[];
}

export interface SplitPricingPreview {
    basis: SplitPricingBasis;
    /** The unit each leg's `distance` is in — "mi" for US tenants, "km" elsewhere. */
    distanceUnit: string;
    parentTotalRevenue: number;
    parentTotalCost: number;
    /** True when the job has no itemised lines and a single synthesised line is being divided. */
    isSynthesised: boolean;
    /** The undivided lines behind the split, each of which can be given its own share. */
    parentLines: SplitPricingParentLine[];
    legs: SplitPricingLeg[];
}

export interface SplitPricingPreviewRequest {
    jobId: number;
    meetingPointAddress: AddressViewModel;
}

// ── The persistent split-parent grid (job/GetSplitPricingBreakdown, edit mode) ─────────────
// Mirrors Models/Dto/SplitPricingBreakdownDto.cs. Reuses SplitPricingParentLine/SplitPricingLeg's
// field names above rather than inventing parallel ones, per docs/pricing §8.

export interface SplitPricingLockState {
    revenueLocked: boolean;
    revenueLockReason: string | null;
    shareLocked: boolean;
    shareLockReason: string | null;
}

export interface SplitPriceBreakdownAllocation {
    legJobId: number;
    sharePercent: number;
    revenue: number;
    cost: number | null;
    costOverride: number | null;
    /** What `cost` would be without `costOverride` — shown as "was X" and what reset reverts to. */
    derivedCost: number | null;
}

export interface SplitPriceBreakdownItem {
    pricingBreakdownId: number;
    name: string;
    revenue: number;
    isAccessorial: boolean;
    allocations: SplitPriceBreakdownAllocation[];
}

export interface SplitPriceBreakdownLeg {
    jobId: number;
    jobNumber: string;
    /** Null renders as "Unassigned" — never blank (spec §3). */
    driverName: string | null;
    sharePercent: number;
    revenue: number;
    cost: number;
    marginPercent: number;
    costLocked: boolean;
    costLockReason: string | null;
}

/** Null response means: not a live split parent, or one with no allocation rows yet (pre-feature
 * split) — the caller falls back to the flat PriceBreakdownDialog, not an error state. */
export interface SplitPriceBreakdown {
    jobId: number;
    totalRevenue: number;
    totalCost: number;
    grossProfit: number;
    marginPercent: number;
    items: SplitPriceBreakdownItem[];
    legs: SplitPriceBreakdownLeg[];
    locks: SplitPricingLockState;
}

export interface SplitPricingItemRevenueUpdate {
    pricingBreakdownId: number;
    revenue: number;
}

export interface SplitPricingAllocationUpdate {
    pricingBreakdownId: number;
    legJobId: number;
    sharePercent?: number;
    costOverride?: number;
    resetCostOverride?: boolean;
}

export interface UpdateSplitPricingBreakdownRequest {
    jobId: number;
    itemRevenues: SplitPricingItemRevenueUpdate[];
    allocations: SplitPricingAllocationUpdate[];
}
