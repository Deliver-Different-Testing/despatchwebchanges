export interface MapPoint {
    lat: number;
    lng: number;
    address: string;
    jobId: number;
    jobNumber: string;
    isFlightRoute: boolean;
}

export interface IMapDriver {
    courierId: number;
    name: string;
    lat: number;
    lng: number;
    assignedJobs: IMapAssignedJob[];
    assignedJobNumber: string;
}

export interface IMapAssignedJob {
    jobId: number;
    jobNumber: string;
}