import {IJob, Suggestion} from "../../../interfaces/job.interface";

export interface MenuState {
    visible: boolean;
    position: {
        top: string | number;
        left: string | number;
    };
    currentJob: IJob | null;
    eventGroups: Suggestion[];
}

export interface IContextMenuScope extends angular.IScope {
    onRefresh: (params?: any) => any;
    onSplitJob: (params: { job: IJob }) => any;
    onRefreshCourierJobs: (params: { courierId: number }) => any;
}
