/**
 * Driver Locations Types
 *
 * Type definitions for the DriverLocations React component.
 */

// Re-export existing interfaces from the main job interface file
export type {
    IClearListViewModel,
    IAreaClearList,
    IClearListSection,
    ICourierData,
    IDestination,
} from '../../../../interfaces/job.interface';

import type {
    IClearListViewModel,
    IAreaClearList,
    IClearListSection,
    ICourierData,
} from '../../../../interfaces/job.interface';

/**
 * Column structure for organizing areas into display columns
 */
export interface IClearListColumn {
    areas: IAreaClearList[];
}

/**
 * Extended view model that includes column-based layout
 * This matches the actual API response structure used in templates
 */
export interface IClearListViewModelWithColumns extends IClearListViewModel {
    columns?: IClearListColumn[];
}

/**
 * Truck mode filter options
 */
export type TruckMode = 'On' | 'Off' | 'Only';

/**
 * Props for the DriverLocations component
 */
export interface DriverLocationsProps {
    /** Driver locations data from the API */
    driverLocations?: IClearListViewModelWithColumns;
    /** Whether data is currently loading */
    loading?: boolean;
    /** Whether to show the no-data state */
    showNoData?: boolean;
    /** Whether to show the data state */
    showData?: boolean;
    /** Current truck mode filter */
    truckMode?: TruckMode;
    /** ID of the currently active/selected area */
    activeAreaId?: number;

    // Callbacks
    /** Called when an area header is clicked */
    onAreaClick?: (area: IAreaClearList) => void;
    /** Called when a courier row is clicked */
    onCourierClick?: (courier: ICourierData) => void;
    /** Called when the clear filter button is clicked */
    onClearFilter?: () => void;

    // Config
    /** Whether the current user is a US customer (affects theming) */
    isUsCustomer?: boolean;
}

/**
 * Props for the AreaSection sub-component
 */
export interface AreaSectionProps {
    /** The area data to display */
    area: IAreaClearList;
    /** Whether this area is active/selected */
    isActive: boolean;
    /** Current truck mode filter */
    truckMode: TruckMode;
    /** Called when the area header is clicked */
    onAreaClick?: (area: IAreaClearList) => void;
    /** Called when a courier row is clicked */
    onCourierClick?: (courier: ICourierData) => void;
}

/**
 * Props for the DriverRow sub-component
 */
export interface DriverRowProps {
    /** The section/driver data */
    section: IClearListSection;
    /** Whether this row is active */
    isActive: boolean;
    /** Visual variant for background color */
    variant: 'top' | 'middle' | 'bottom';
    /** Called when the row is clicked */
    onClick?: () => void;
}

/**
 * Checks if a courier should be shown based on truck mode
 */
export function shouldShowCourier(courierNumber: string, truckMode: TruckMode): boolean {
    const isTruck = courierNumber.indexOf('T') >= 0;

    switch (truckMode) {
        case 'Only':
            return isTruck;
        case 'Off':
            return !isTruck;
        case 'On':
        default:
            return true;
    }
}
