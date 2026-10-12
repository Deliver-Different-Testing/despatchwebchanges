/**
 * Types for CurrentWorkAllDrivers component
 */

export interface IDriverWorkOverview {
    courierId: number;
    name: string;
    vehicleType: string;
    jobCount: number;
    driverStatusText: string;
}

export type SortOrder = 'asc' | 'desc';

export interface CurrentWorkAllDriversProps {
    drivers: IDriverWorkOverview[];
    loading?: boolean;
    selectedCourierId?: number;
    onDriverSelect: (driver: IDriverWorkOverview) => void;
}
