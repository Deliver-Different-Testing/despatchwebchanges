import {Dayjs} from "dayjs";

export interface ICourierCompliance {
    courierId: number;
    code: string;
    name: string;
    complianceType: string;
    itemNumber: string;
    expiryDate?: Dayjs;
    status: string;
    daysUntilExpiry: string;
}

export interface ICourierComplianceDto {
    courierId: number;
    code: string;
    name: string;
    complianceType: string;
    itemNumber: string;
    expiryDate?: string;
    status: string;
    daysUntilExpiry: string;
}