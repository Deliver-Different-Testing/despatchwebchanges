import "./event-group-dialog.styles.less";
import {Suggestion} from "../../../interfaces/job.interface";
import ToastrService from "../../../services/toastr.service";
import {EventGroupViewModel} from "../../../interfaces/event-group-view-model.interface";
import BaseController from "../../base-controller";

export class EventGroupDialogController extends BaseController{
    searchText?: string;
    selectedUser?: Suggestion;
    minDate: Date;
    maxDate: Date;

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
        super();

        // Min and max dates
        this.minDate = new Date();
        this.maxDate = new Date();
        this.maxDate.setDate(this.maxDate.getFullYear() + 15);
    }

    async save(jobId: number, events: EventGroupViewModel[]) {
        try {
            const activeEvents = events.filter(event => event.active);
            if (activeEvents.length === 0) {
                this.toastrService.showWarningToast('No events are active. Please select active events to assign.');
                return;
            }

            const unassignedEvents = activeEvents.filter(event => !event.assignTo);
            if (unassignedEvents.length > 0) {
                this.toastrService.showWarningToast('Please assign all active events before saving.');
                return;
            }

            await this.$http.post('task/AddTasks', {
                jobId,
                eventGroupViewModels: activeEvents
            });

            const taskCount = activeEvents.length;
            this.toastrService.showSuccessToast(`${taskCount} task${taskCount !== 1 ? 's' : ''} added successfully`);

            // Close dialog
            this.$mdDialog.hide();
        } catch (error) {
            console.error('EventGroupDialogController: Error in save', error);
            this.toastrService.showErrorToast();
        }
    }

    querySearch(text: string): Suggestion[] {
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
