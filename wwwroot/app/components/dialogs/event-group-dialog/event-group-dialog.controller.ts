import "./event-group-dialog.styles.less";
import {ISuggestion} from "../../../interfaces/job.interface";
import ToastrService from "../../../services/toastr.service";
import {EventGroupViewModel} from "../../../interfaces/event-group-view-model.interface";
import BaseController from "../../base-controller";
import dayjs from "dayjs";
import NavigationService from "../../../services/navigation.service";

export class EventGroupDialogController extends BaseController {
    searchText?: string;
    minDate: Date;
    maxDate: Date;
    browserTimeZone: string;

    static $inject = [
        '$mdDialog',
        '$log',
        '$http',
        'toastrService',
        'navigationService',
        '$timeout',
        '$interval',
        'jobId',
        'eventTypeGroups',
        'users'
    ];

    constructor(
        private $mdDialog: angular.material.IDialogService,
        private $log: angular.ILogService,
        private $http: angular.IHttpService,
        private toastrService: ToastrService,
        private navigationService: NavigationService,
        $timeout: angular.ITimeoutService,
        $interval: angular.IIntervalService,
        public jobId: number,
        public events: EventGroupViewModel[],
        public users: ISuggestion[],
    ) {
        super();
        this.initServices($timeout, $interval);

        this.browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

        // Min and max dates
        this.minDate = new Date();
        this.maxDate = dayjs().add(15, 'year').toDate();

        this.$log.debug('EventGroupDialog initialized with', events.length, 'event groups');
    }

    async save(jobId: number, events: EventGroupViewModel[]) {
        try {
            this.$log.debug('Processing event save request');

            const activeEvents = events.filter(event => event.active);
            if (activeEvents.length === 0) {
                this.toastrService.showWarningToast('No events are active. Please select at least one event to add to the job.');
                return;
            }

            activeEvents.forEach(event => {
                if (event.dueTime !== undefined) {
                    event.dueTime = dayjs(event.dueTime).format();
                }
            })

            await this.$http.post('task/AddTasks', {
                jobId,
                eventGroupViewModels: activeEvents
            });

            const taskCount = activeEvents.length;

            this.toastrService.showSuccessToast(`${taskCount} task${taskCount !== 1 ? 's' : ''} added successfully`);
            this.$mdDialog.hide();
        } catch (error) {
            this.$log.error('EventGroupDialogController: Error in save', error);
            this.toastrService.showErrorToast();
        }
    }

    querySearch(text: string): ISuggestion[] {
        let results: ISuggestion[];

        if (!text) {
            results = this.users;
        } else {
            const lowercaseQuery = text.toLowerCase();
            results = this.users.filter(user =>
                user.text.toLowerCase().includes(lowercaseQuery)
            );
        }

        this.$log.debug('Search query processed with', results.length, 'results');
        return results.length > 0 ? results : this.users;
    }

    selectedUserChange(user: ISuggestion, index: number): void {
        if (user && user.text) {
            if (!this.events[index].assignTo) {
                this.events[index].assignTo = {text: '', id: 0};
            }

            this.events[index].assignTo.text = user.text;
            this.events[index].assignTo.id = user.id;
            this.$log.debug('User assigned to event at index', index, ':', user.text);
        }
    }
    
    async goToAdminManager() {
        await this.navigationService.openAdminManagerUrl();
    }

    cancel(): void {
        this.$mdDialog.cancel();
    }
}
