import JobSearchBoxes from './jobSearchBoxes';
import {IBox, ILayout} from '../../../../interfaces/layout.interfaces';

export function createJobSearchBoxes(): Record<string, IBox> {
    return {
        [JobSearchBoxes.SearchWidget]: {
            name: JobSearchBoxes.SearchWidget,
            title: 'Filters',
            icon: 'filter_list',
            showRefresh: false,
            visible: true,
            description: 'Search filters and date range selection for job queries',
        },
        [JobSearchBoxes.JobList]: {
            name: JobSearchBoxes.JobList,
            title: 'Live Job Data',
            icon: 'list_alt',
            showRefresh: true,
            visible: true,
            description: 'Real-time list of active jobs with current status',
        },
        [JobSearchBoxes.BulkJobList]: {
            name: JobSearchBoxes.BulkJobList,
            title: 'Bulk Job Data',
            icon: 'format_list_bulleted',
            showRefresh: true,
            visible: true,
            description: 'Aggregated view of multiple jobs for bulk operations',
        },
        [JobSearchBoxes.JobDetail]: {
            name: JobSearchBoxes.JobDetail,
            title: 'Detail',
            icon: 'assignment',
            showDetailButtons: true,
            showRefresh: true,
            visible: true,
            description: 'Comprehensive job information with action buttons',
        },
        [JobSearchBoxes.ScanList]: {
            name: JobSearchBoxes.ScanList,
            title: 'Scan Detail',
            icon: 'document_scanner',
            showRefresh: false,
            visible: true,
            description: 'Detailed scan information and document history',
        },
        [JobSearchBoxes.Map]: {
            name: JobSearchBoxes.Map,
            title: 'Map',
            icon: 'pin_drop',
            showRefresh: false,
            visible: true,
            description: 'Geographic visualization of job locations',
        },
        [JobSearchBoxes.DeliveryJourney]: {
            name: JobSearchBoxes.DeliveryJourney,
            title: 'Delivery Journey',
            icon: 'rocket_launch',
            showRefresh: false,
            visible: true,
            description: 'Timeline and history of job delivery progress',
        },
    };
}

export function createDefaultJobSearchLayout(): ILayout {
    return {
        name: 'Default',
        layout: {
            columns: [
                {
                    id: 'col1',
                    width: '20%',
                    boxes: [{name: JobSearchBoxes.SearchWidget, height: '100%'}],
                },
                {
                    id: 'col2',
                    width: '25%',
                    boxes: [
                        {name: JobSearchBoxes.JobList, height: '50%'},
                        {name: JobSearchBoxes.BulkJobList, height: '50%'},
                    ],
                },
                {
                    id: 'col3',
                    width: '35%',
                    boxes: [
                        {name: JobSearchBoxes.JobDetail, height: '40%'},
                        {name: JobSearchBoxes.ScanList, height: '30%'},
                        {name: JobSearchBoxes.Map, height: '30%'},
                    ],
                },
                {
                    id: 'col4',
                    width: '20%',
                    boxes: [{name: JobSearchBoxes.DeliveryJourney, height: '100%'}],
                },
            ],
        },
    };
}
