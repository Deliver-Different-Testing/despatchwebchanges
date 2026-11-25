export interface ForwardAirJob {
    jobId: number;
    status?: string;
    serviceLevel?: string;
    airbillNumber?: string;
    originAirportCode?: string;
    destinationAirportCode?: string;
    remarks?: string;
    lastStatusCode?: string;
    lastStatusDescription?: string;
    lastStatusAtUtc?: string;
    etaLocal?: string;
    deliveryDocumentAvailable: boolean;
    lastError?: string;
    bookedAtUtc?: string;
}
