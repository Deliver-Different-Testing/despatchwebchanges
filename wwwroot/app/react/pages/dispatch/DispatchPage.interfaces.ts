/**
 * Dispatch Page Interfaces
 */

import type {ShowToastFn} from '../../services/toastService';

/** Box identifiers matching the existing AngularJS DispatchBoxes enum */
export enum DispatchBox {
    JobsList = 'list',
    JobDetail = 'detail',
    CurrentWork = 'currentWork',
    Supports = 'supports',
    DriverLocations = 'driverLocations',
    Map = 'map',
}

/** Box metadata for rendering widget panels */
export interface BoxConfig {
    id: DispatchBox;
    title: string;
    icon: string;
    showRefresh: boolean;
    showDetailButtons?: boolean;
    description: string;
}

/** Box visibility state */
export interface BoxState {
    visible: boolean;
}

/** Existing AngularJS layout interfaces - mirrored for compatibility */
export interface IBox {
    name: string;
    height?: string;
}

export interface IColumn {
    id: string;
    width: string;
    boxes: IBox[];
}

export interface ILayout {
    name: string;
    layout: {
        columns: IColumn[];
    };
}

/** Props for the dispatch page when mounted from AngularJS */
export interface MountDispatchConfig {
    showToast: ShowToastFn;
    isUsCustomer: boolean;
    initialJobId?: number | null;
    onNavigate: (state: string) => void;
}

export interface DispatchPageProps {
    showToast: ShowToastFn;
    isUsCustomer: boolean;
    initialJobId?: number | null;
    onNavigate: (state: string) => void;
    setRefreshCallback?: (callback: () => void) => void;
}

/** All box configs */
export const BOX_CONFIGS: Record<DispatchBox, BoxConfig> = {
    [DispatchBox.JobsList]: {
        id: DispatchBox.JobsList,
        title: 'Job List',
        icon: 'list_alt',
        showRefresh: true,
        description: 'Sortable list of all active and pending jobs',
    },
    [DispatchBox.JobDetail]: {
        id: DispatchBox.JobDetail,
        title: 'Job Detail',
        icon: 'assignment',
        showRefresh: true,
        showDetailButtons: true,
        description: 'Detailed information for selected job including status and actions',
    },
    [DispatchBox.CurrentWork]: {
        id: DispatchBox.CurrentWork,
        title: 'Current Work',
        icon: 'local_shipping',
        showRefresh: false,
        description: 'Overview of jobs currently in progress',
    },
    [DispatchBox.Supports]: {
        id: DispatchBox.Supports,
        title: 'Support Tasks',
        icon: 'support',
        showRefresh: true,
        description: 'Manage support requests and auxiliary tasks',
    },
    [DispatchBox.DriverLocations]: {
        id: DispatchBox.DriverLocations,
        title: 'Driver Locations',
        icon: 'person_pin_circle',
        showRefresh: false,
        description: 'Real-time tracking of all driver positions',
    },
    [DispatchBox.Map]: {
        id: DispatchBox.Map,
        title: 'Map',
        icon: 'pin_drop',
        showRefresh: true,
        description: 'Interactive map view showing job locations and routes',
    },
};
