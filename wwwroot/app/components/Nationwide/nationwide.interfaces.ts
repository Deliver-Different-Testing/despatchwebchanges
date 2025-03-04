export interface FlightViewModel {
    airline: string;
    flightNumber: string;
    departureTime: Date;
    arrivalTime: Date;
    departureAirport: string;
    arrivalAirport: string;
    duration: string;
    stops: number;
    aircraft: string;
    serviceClasses: string[];
    isCodeShare: boolean;
    amount: number;
    codeShareAirline: string;
}

export interface AgentViewModel {
    agentId: number;
    agentName: string;
    agentRate: number;
    agentRanking: string;
}

export interface Filter {
    value: number;
    label: string;
    icon: string;
    active: boolean;
}

export interface JobFilter {
    order: string;
    filter: string;
    status: string;
    asc: string;
    page: number;
    limit: number;
}
