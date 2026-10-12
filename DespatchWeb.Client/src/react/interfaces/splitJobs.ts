import {AddressViewModel} from "../interfaces";
import {SplitPricingBasis} from "../services/splitJobApi";

export interface SplitPricingAllocationItem {
    sequence: number;
    sharePercent: number;
}

export interface SplitPricingLineAllocationItem {
    pricingBreakdownId: number;
    sequence: number;
    sharePercent: number;
    costOverride?: number;
}

export interface SplitJobRequest {
    jobId: number;
    meetingPointAddress: AddressViewModel;
    courierIdForLegB?: number | null;
    pricingAllocation?: SplitPricingAllocationItem[] | null;
    lineAllocation?: SplitPricingLineAllocationItem[] | null;
}

export interface SplitPricingLine {
    pricingBreakdownId: number;
    name: string;
    revenue: number;
    cost: number;
}

export interface SplitPricingParentLine {
    pricingBreakdownId: number;
    name: string;
    revenue: number;
    cost: number;
    isAccessorial: boolean;
}

export interface SplitPricingLeg {
    sequence: number;
    letterSuffix: string;
    jobNumber: string;
    distance: number;
    sharePercent: number;
    totalRevenue: number;
    totalCost: number;
    lines: SplitPricingLine[];
}

export interface SplitPricingPreview {
    basis: SplitPricingBasis;
    distanceUnit: string;
    parentTotalRevenue: number;
    parentTotalCost: number;
    isSynthesised: boolean;
    parentLines: SplitPricingParentLine[];
    legs: SplitPricingLeg[];
}

export interface SplitPricingPreviewRequest {
    jobId: number;
    meetingPointAddress: AddressViewModel;
}

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
    driverName: string | null;
    sharePercent: number;
    revenue: number;
    cost: number;
    marginPercent: number;
    costLocked: boolean;
    costLockReason: string | null;
}

export interface SplitPriceBreakdown {
    jobId: number;
    isArchived?: boolean;
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
    name?: string;
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
    isArchived?: boolean;
    itemRevenues: SplitPricingItemRevenueUpdate[];
    allocations: SplitPricingAllocationUpdate[];
}
