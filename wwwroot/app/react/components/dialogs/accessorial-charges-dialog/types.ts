/**
 * Accessorial Charges Dialog Types
 */

import type {ShowToastFn} from '../../../services/toastService';

export interface AccessorialChargeDto {
    accessorialChargeId: number;
    name: string;
    description: string;
    chargeType: string;
    unitTypeId?: number;
    unitTypeName?: string;
    baseRate?: number;
    ratePerUnit?: number;
    percentageRate?: number;
    minimumCharge?: number;
    maximumCharge?: number;
    minimumQuantity?: number;
    freeAllowance?: number;
    freeAllowanceUnitTypeId?: number;
    freeAllowanceUnitTypeName?: string;
    conditionalNote?: string;
    calculationOrder: number;
    alreadyApplied: boolean;
}

export interface JobAccessorialChargeDto {
    jobAccessorialChargeId: number;
    jobId: number;
    accessorialChargeId: number;
    name: string;
    chargeType: string;
    unitTypeId?: number;
    unitTypeName?: string;
    baseRate?: number;
    ratePerUnit?: number;
    percentageRate?: number;
    freeAllowance?: number;
    freeAllowanceUnitTypeName?: string;
    minimumQuantity?: number;
    minimumCharge?: number;
    maximumCharge?: number;
    inputValue?: number;
    itemCount: number;
    calculatedAmount?: number;
    overrideAmount?: number;
    calculationOrder: number;
    notes?: string;
    addedAtStage?: string;
    createdBy?: string;
    created?: string;
    alwaysApply: boolean;
}

export interface JobAccessorialChargeCreateRequest {
    accessorialChargeId: number;
    inputValue?: number;
    itemCount: number;
    notes?: string;
}

export interface JobAccessorialChargeUpdateRequest {
    inputValue?: number;
    itemCount: number;
    notes?: string;
    overrideAmount?: number;
}

export interface PortionJobInfo {
    jobId: number;
    label: string;
    accessorialChargeGroupId?: number;
}

export interface AccessorialChargesJob {
    id: number;
    accessorialChargeGroupId: number;
    amount?: number;
    weight?: number;
    quantity?: number;
    portionJobs?: PortionJobInfo[];
}

export interface AccessorialChargesDialogProps {
    open: boolean;
    job: AccessorialChargesJob | null;
    onClose: () => void;
    showToast: ShowToastFn;
}

export interface OpenAccessorialChargesDialogOptions {
    job: AccessorialChargesJob;
    toastService?: {
        showToast: ShowToastFn;
    };
}
