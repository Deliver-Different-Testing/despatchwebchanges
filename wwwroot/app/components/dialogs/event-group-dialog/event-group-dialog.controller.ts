import app from "../../../app";
import "./event-group-dialog.styles.less";
import {Suggestion} from "../../../interfaces/job.interface";
import FeatureInDevelopmentDialogService from "../feature-in-development-dialog/feature-in-development-dialog.service";

export interface EventGroupViewModel {
    eventType: string;
    group: string;
    sequence: number;
    dueTime: number;
    assignTo: string;
    active: boolean;
}

export class EventGroupDialogController implements angular.IController {
    events: EventGroupViewModel[] = [];
    users: Suggestion[] = [];
    filteredUsers: Suggestion[] = [];
    searchText: string = '';
    selectedUser?: Suggestion;

    static $inject = [
        '$mdDialog',
        'featureInDevelopmentDialogService',
        'eventTypeGroups',
        'users'
    ];

    constructor(
        private $mdDialog: angular.material.IDialogService,
        private featureInDevelopmentDialogService: FeatureInDevelopmentDialogService,
        eventTypeGroups: EventGroupViewModel[],
        users: Suggestion[],
    ) {
        this.events = eventTypeGroups || [];
        this.users = users || [];
    }

    cancel(): void {
        this.$mdDialog.cancel();
    }

   async save() {
        await this.featureInDevelopmentDialogService.openFeatureInDevelopmentDialog();
    }

    querySearch(text: string, index: number): Suggestion[] {
        return text ? this.users.filter(this.createFilterFor(text)) : this.users;
    }

    private createFilterFor(query: string): (user: Suggestion) => boolean {
        const lowercaseQuery = query.toLowerCase();
        return (user: Suggestion) => {
            return user.text.toLowerCase().indexOf(lowercaseQuery) === 0;
        };
    }

    selectedUserChange(user: Suggestion, index: number): void {
        if (user && user.text) {
            this.events[index].assignTo = user.text;
        }
    }
}

app.controller('EventGroupDialogController', EventGroupDialogController);
