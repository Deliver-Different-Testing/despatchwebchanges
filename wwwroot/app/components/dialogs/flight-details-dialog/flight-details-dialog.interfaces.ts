export interface FlightDetailsViewModel {
    // Basic flight details
    flightNumber: string;
    carrierCode: string;
    airlineName: string;
    serviceType: string;

    // Route information
    origin: AirportViewModel;
    destination: AirportViewModel;
    departureTime: string;
    arrivalTime: string;
    duration: string;
    stops: number;
    isNonStop: boolean;
    arrivalTerminal?: string;

    // Aircraft details
    aircraft: string;
    aircraftType: string;

    // Service details
    serviceClasses: string[];
    isCodeShare: boolean;
    isWetLease: boolean;

    // Related flight details
    operatedBy?: OperatorViewModel;
    codeShares?: CodeShareViewModel[];

    // Metadata
    flightId?: string;
    referenceCode?: string;
}

export interface AirportViewModel {
    code: string;
    name: string;
    city: string;
    country: string;
    timezone: string;
    elevation: number;
    latitude: number;
    longitude: number;
}

export interface OperatorViewModel {
    carrierCode: string;
    flightNumber: string;
    airlineName: string;
    serviceType: string;
}

export interface CodeShareViewModel {
    carrierCode: string;
    flightNumber: string;
    serviceType: string;
    serviceClasses: string[];
}
