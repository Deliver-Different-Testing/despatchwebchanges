import app from "../../../app";
import "./event-group-dialog.styles.less";
import {Suggestion} from "../../../interfaces/job.interface";
import FeatureInDevelopmentDialogService from "../feature-in-development-dialog/feature-in-development-dialog.service";
import ToastrService from "../../../services/toastr.service";

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

export class EventGroupDialogController implements angular.IController {
    filteredUsers: Suggestion[] = [];
    searchText: string = '';
    selectedUser?: Suggestion;

    static $inject = [
        '$mdDialog',
        '$http',
        'toastrService',
        'jobId',
        'eventTypeGroups',
        'users'
    ];

    constructor(
        private $mdDialog: angular.material.IDialogService,
        private $http: angular.IHttpService,
        private toastrService: ToastrService,
        public jobId: number,
        public events: EventGroupViewModel[],
        public users: Suggestion[],
    ) {
    }

    cancel(): void {
        this.$mdDialog.cancel();
    }

    async save(jobId: number, events: EventGroupViewModel[]) {
        try {
            await this.addTasksToJob(jobId, events);
            const taskCount = this.events.length;
            this.toastrService.showSuccessToast(`${taskCount} task${taskCount !== 1 ? 's' : ''} added successfully`);
        } catch (error) {
            console.error('EventGroupDialogController: Error in save', error);
            this.toastrService.showErrorToast();
        }
    }

    private async addTasksToJob(jobId: number, eventGroupViewModels: EventGroupViewModel[]) {
        await this.$http.post('task/AddTasks', {
            jobId,
            eventGroupViewModels
        });
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
            this.events[index].assignTo.text = user.text;
        }
    }
}

app.controller('EventGroupDialogController', EventGroupDialogController);
