import app from "../../../app";
import "./event-group-dialog.styles.less";
import {Suggestion} from "../../../interfaces/job.interface";
import ToastrService from "../../../services/ToastrService";
import {EventGroupViewModel} from "../../../interfaces/event-group-view-model.interface";

export class EventGroupDialogController implements angular.IController {
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

    async save(jobId: number, events: EventGroupViewModel[]) {
        try {
            const activeEvents = events.filter(event => event.active);

            await this.addTasksToJob(jobId, activeEvents);
            const taskCount = activeEvents.length;
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
        if (!text) return this.users;

        const lowercaseQuery = text.toLowerCase();
        return this.users.filter(user =>
            user.text.toLowerCase().includes(lowercaseQuery)
        );
    }

    selectedUserChange(user: Suggestion, index: number): void {
        if (user && user.text) {
            if (!this.events[index].assignTo) {
                this.events[index].assignTo = { text: '', id: 0 };
            }

            this.events[index].assignTo.text = user.text;
            this.events[index].assignTo.id = user.id;
        }
    }

    cancel(): void {
        this.$mdDialog.cancel();
    }
}

app.controller('EventGroupDialogController', EventGroupDialogController);
