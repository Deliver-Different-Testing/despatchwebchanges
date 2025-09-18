export interface ICourierDataDashboard {
    courierId: number;
    basicInformation: BasicInformation;
    contactInformation: ContactInformation;
    vehicleInformation: VehicleInformation;
    compliance: Compliance;
    bankingAndEmergency: BankingAndEmergency;
    additionalInformation: AdditionalInformation;
}

export interface BasicInformation {
    code: string;
    firstName: string;
    surname: string;
    email: string;
    address: string;
}

export interface ContactInformation {
    mobile: string;
    home: string;
    gstNumber: string;
    irdNumber: string;
}

export interface VehicleInformation {
    rego: string;
    vehicleYear?: number;
    vehicleModel: string;
    vehicleInsurance: string;
}

export interface Compliance {
    dangerousGoods?: boolean;
    dangerousGoodsExpiry?: Date;
    driversLicenceExpiry?: Date;
}

export interface BankingAndEmergency {
    emergencyContact: boolean;
    bank: string;
    securityCheck: boolean;
}

export interface AdditionalInformation {
    contactSignDate?: Date;
    mobileInsurence?: number;
    dailyProfitAdjust: number;
    notes: string;
}