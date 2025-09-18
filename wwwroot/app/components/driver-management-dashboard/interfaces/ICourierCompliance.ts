interface ICourierCompliance {
    courierId: number;
    code: string;
    name: string;
    complianceType: string;
    itemNumber: string;
    expiryDate?: Date;
    status: string;
    daysUntilExpiry: string;
}

export default ICourierCompliance;