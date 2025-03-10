import {Suggestion} from "./job.interface";

export interface EventGroupViewModel {
    eventTypeGroupTypeGroupId: number;
    eventType: Suggestion;
    group: string;
    date: Date;
    sequence: number;
    dueTime: number;
    assignTo: Suggestion;
    notes: string;
    active: boolean;
}
