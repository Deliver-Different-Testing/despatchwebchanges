export interface PriceBreakdown {
    chargeId: number;
    name: string;
    amount: number;
    jobId?: number;
    prebookJobId?: number;
    costAmount?: number;
    childJobId?: number;
    isArchived?: boolean;
}

export interface CreatePriceBreakdownRequest {
    name: string;
    amount: number;
    costAmount?: number;
    jobId?: number;
    prebookJobId?: number;
    childJobId?: number;
    isArchived?: boolean;
}

export interface DeletePriceBreakdownRequest {
    chargeId: number;
    jobId: number;
    isArchived?: boolean;
}

export interface SuggestedFuelCharge {
    fuelChargeAmount: number;
    fuelCostAmount: number;
}