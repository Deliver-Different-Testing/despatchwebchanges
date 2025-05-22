import "./event-group-dialog.styles.less";
import {Suggestion} from "../../../interfaces/job.interface";
import ToastrService from "../../../services/toastr.service";
import {EventGroupViewModel} from "../../../interfaces/event-group-view-model.interface";
import BaseController from "../../base-controller";
import dayjs from "dayjs";

export class EventGroupDialogController extends BaseController{
    searchText?: string;
    selectedUser?: Suggestion;
    minDate: Date;
    maxDate: Date;
    browserTimeZone: string;

    static $inject = [
        '$mdDialog',
        '$http',
        'toastrService',
        '$timeout',
        'jobId',
        'eventTypeGroups',
        'users'
    ];

    constructor(
        private $mdDialog: angular.material.IDialogService,
        private $http: angular.IHttpService,
        private toastrService: ToastrService,
        private $timeout: angular.ITimeoutService,
        public jobId: number,
        public events: EventGroupViewModel[],
        public users: Suggestion[],
    ) {
        super();

        this.browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

        // Min and max dates
        this.minDate = new Date();
        this.maxDate = new Date();
        this.maxDate.setDate(this.maxDate.getFullYear() + 15);

        this.$timeout(() => {
            console.log('EventGroupDialog initialized with', events.length, 'event groups');
        });
    }

    async save(jobId: number, events: EventGroupViewModel[]) {
        try {
            this.$timeout(() => {
                console.log('Processing event save request');
            });

            const activeEvents = events.filter(event => event.active);
            if (activeEvents.length === 0) {
                this.toastrService.showWarningToast('No events are active. Please select at least one event to add to the job.');
                return;
            }

            activeEvents.forEach(event => {
                if (event.dueTime !== undefined) {
                    event.dueTime = dayjs(event.dueTime).utc().format();
                }
            })

            await this.$http.post('task/AddTasks', {
                jobId,
                eventGroupViewModels: activeEvents
            });

            const taskCount = activeEvents.length;

            this.$timeout(() => {
                this.toastrService.showSuccessToast(`${taskCount} task${taskCount !== 1 ? 's' : ''} added successfully`);
                // Close dialog
                this.$mdDialog.hide();
            });
        } catch (error) {
            console.error('EventGroupDialogController: Error in save', error);
            this.toastrService.showErrorToast();
        }
    }

    querySearch(text: string): Suggestion[] {
        let results: Suggestion[] = [];

        this.$timeout(() => {
            if (!text) {
                results = this.users;
            } else {
                const lowercaseQuery = text.toLowerCase();
                results = this.users.filter(user =>
                    user.text.toLowerCase().includes(lowercaseQuery)
                );
            }

            console.log('Search query processed with', results.length, 'results');
        });

        return results.length > 0 ? results : this.users;
    }

    selectedUserChange(user: Suggestion, index: number): void {
        this.$timeout(() => {
            if (user && user.text) {
                if (!this.events[index].assignTo) {
                    this.events[index].assignTo = { text: '', id: 0 };
                }

                this.events[index].assignTo.text = user.text;
                this.events[index].assignTo.id = user.id;
                console.log('User assigned to event at index', index, ':', user.text);
            }
        });
    }

    cancel(): void {
        this.$mdDialog.cancel();
    }
}
