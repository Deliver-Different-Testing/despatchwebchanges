import DispatchBoxes from '../../../../components/home/enums/DispatchBoxes';
import {IBox, ILayout} from '../../../../interfaces/layout.interfaces';

/**
 * Box definitions for the React Dispatch page (V2). Mirrors
 * `wwwroot/app/react/pages/job-search/lib/boxDefinitions.ts` but enumerates the
 * six dispatch boxes (see `components/home/enums/DispatchBoxes.ts`).
 */
export function createDispatchBoxes(): Record<string, IBox> {
    return {
        [DispatchBoxes.JobsList]: {
            name: DispatchBoxes.JobsList,
            title: 'Job List',
            icon: 'list_alt',
            showRefresh: true,
            visible: true,
            description: 'Real-time list of dispatch jobs with current status',
        },
        [DispatchBoxes.JobDetail]: {
            name: DispatchBoxes.JobDetail,
            title: 'Detail',
            icon: 'assignment',
            showDetailButtons: true,
            showRefresh: true,
            visible: true,
            description: 'Comprehensive job information with action buttons',
        },
        [DispatchBoxes.CurrentWork]: {
            name: DispatchBoxes.CurrentWork,
            title: 'Current Work',
            icon: 'local_shipping',
            showRefresh: true,
            visible: true,
            description: 'Active courier assignments and in-progress work',
        },
        [DispatchBoxes.Supports]: {
            name: DispatchBoxes.Supports,
            title: 'Tasks',
            icon: 'support_agent',
            showRefresh: false,
            visible: true,
            description: 'Task management and support items',
        },
        [DispatchBoxes.DriverLocations]: {
            name: DispatchBoxes.DriverLocations,
            title: 'Driver Locations',
            icon: 'my_location',
            showRefresh: false,
            visible: true,
            description: 'Live driver positions',
        },
        [DispatchBoxes.Map]: {
            name: DispatchBoxes.Map,
            title: 'Map',
            icon: 'pin_drop',
            showRefresh: false,
            visible: true,
            description: 'Geographic visualization of job locations',
        },
    };
}

export function createDefaultDispatchLayout(): ILayout {
    return {
        name: 'Default',
        layout: {
            columns: [
                {
                    id: 'col1',
                    width: '50%',
                    boxes: [
                        {name: DispatchBoxes.JobsList, height: '50%'},
                        {name: DispatchBoxes.JobDetail, height: '50%'},
                    ],
                },
                {
                    id: 'col2',
                    width: '25%',
                    boxes: [
                        {name: DispatchBoxes.CurrentWork, height: '50%'},
                        {name: DispatchBoxes.Supports, height: '50%'},
                    ],
                },
                {
                    id: 'col3',
                    width: '25%',
                    boxes: [
                        {name: DispatchBoxes.DriverLocations, height: '50%'},
                        {name: DispatchBoxes.Map, height: '50%'},
                    ],
                },
            ],
        },
    };
}
