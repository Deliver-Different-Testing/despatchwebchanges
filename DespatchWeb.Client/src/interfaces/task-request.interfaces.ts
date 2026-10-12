interface ITaskUpdateBaseRequest {
    eventId: number;
}

export interface ITaskCloseRequest extends ITaskUpdateBaseRequest {
    closed: boolean;
}

export interface ITaskDateRequest extends ITaskUpdateBaseRequest {
    date: string;
}

export interface ITaskTimeRequest extends ITaskUpdateBaseRequest {
    time: string;
}

export interface ITaskAssignStaffRequest extends ITaskUpdateBaseRequest {
    staffId: number;
}