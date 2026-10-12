import {ISuggestion} from "./job.interface";

export interface IEventGroupViewModel {
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
