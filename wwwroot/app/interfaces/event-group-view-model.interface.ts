import {ISuggestion} from "./job.interface";

export interface EventGroupViewModel {
    eventTypeGroupTypeGroupId: number;
    eventType: ISuggestion;
    group: string;
    date: Date;
    sequence: number;
    dueTime?: Date | string;
    assignTo?: ISuggestion;
    notes: string;
    active: boolean;
}
