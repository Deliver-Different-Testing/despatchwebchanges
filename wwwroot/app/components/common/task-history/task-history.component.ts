import "./task-history.styles.less";
import BaseController from "../../base-controller";
import {IDeliveryHistoryConfig, DeliveryJourneyViewModel} from "./task-history.interfaces";
import ToastrService from "../../../services/toastr.service";
import {AppConfig} from "../../../interfaces/app-config.interface";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import DispatchCoreService from "../../../services/dispatch-core.service";
import DensityMode from "../../../enums/densityMode";

class TaskHistoryController extends BaseController {
    static $inject = [
        'toastrService',
        'DispatchData',
        '$timeout',
        '$interval',
        'APP_CONFIG',
    ];

    readonly isUsCustomer: boolean = false;
    readonly DensityMode = DensityMode;

    jobId?: number;
    config?: IDeliveryHistoryConfig;
    onDeliveryEventClick?: (params: { deliveryEvent: DeliveryJourneyViewModel }) => void;
    timeZone: string;
    shouldAnimate: boolean = false;

    // Journey data
    deliveryEvents: DeliveryJourneyViewModel[] = [];

    // Combined timeline items
    timelineItems: Array<{
        type: 'delivery-event';
        data: DeliveryJourneyViewModel;
        timestamp: string;
    }> = [];

    historyLoading?: boolean;
    densityMode: DensityMode = DensityMode.Normal;

    constructor(
        private toastrService: ToastrService,
        private DispatchData: DispatchCoreService,
        $timeout: angular.ITimeoutService,
        $interval: angular.IIntervalService,
        appConfig: AppConfig
    ) {
        super();

        this.initServices($timeout, $interval);
        dayjs.extend(relativeTime);

        this.isUsCustomer = appConfig.US_Customer;
        this.timeZone = TimeZone;
    }

    $onInit() {
        this.loadDeliveryJourney();
        this.startAnimation();
        this.setUpRefreshInterval();

        this.densityMode = this.config?.densityMode || DensityMode.Normal;
    }

    $onChanges(changes: angular.IOnChangesObject) {
        if (changes.jobId) this.loadDeliveryJourney();
    }

    cycleDensityMode() {
        const modes: DensityMode[] = [DensityMode.Normal, DensityMode.Dense, DensityMode.UltraDense];
        const currentIndex = modes.indexOf(this.densityMode);
        const nextIndex = (currentIndex + 1) % modes.length;
        this.densityMode = modes[nextIndex];

        if (this.config) {
            this.config.densityMode = this.densityMode;
        }
    }

    getWidgetClass(): string {
        return this.densityMode !== DensityMode.Normal ? `${this.densityMode}-mode` : '';
    }

    getDensityModeLabel(): string {
        switch (this.densityMode) {
            case DensityMode.Normal:
                return 'Normal View';
            case DensityMode.Dense:
                return 'Dense View';
            case DensityMode.UltraDense:
                return 'Ultra-Dense View';
            default:
                return 'Normal View';
        }
    }

    getDensityModeIcon(): string {
        switch (this.densityMode) {
            case DensityMode.Normal:
                return 'view_agenda';
            case DensityMode.Dense:
                return 'view_compact';
            case DensityMode.UltraDense:
                return 'view_compact_alt';
            default:
                return 'view_agenda';
        }
    }
    
    private startAnimation() {
        this.registerTimeout(() => {
            this.shouldAnimate = true;
        }, 100);
    }

    private setUpRefreshInterval() {
        this.registerInterval(async () => {
            if (this.jobId) this.loadDeliveryJourney();
        }, 120000);
    }

    loadDeliveryJourney() {
        if (!this.jobId) {
            this.initializeEmptyData();
            return;
        }

        this.historyLoading = true;
        this.DispatchData.getDeliveryJourney(this.jobId)
            .then((deliveryJourney) => {
                this.buildTimelineFromDeliveryJourney(deliveryJourney);
            })
            .catch((error) => {
                console.error('Error loading delivery journey:', error);
                this.toastrService.showErrorToast('Failed to load delivery journey');
                this.initializeEmptyData();
            })
            .finally(() => {
                this.historyLoading = false;
                console.log('Delivery journey loaded');
            });
    }

    private initializeEmptyData() {
        this.deliveryEvents = [];
        this.timelineItems = [];
    }

    private buildTimelineFromDeliveryJourney(deliveryJourney: DeliveryJourneyViewModel[]) {
        // Backend handles all sorting and processing
        this.deliveryEvents = deliveryJourney;

        // Build timeline items directly from the delivery journey
        this.timelineItems = deliveryJourney.map((event) => ({
            type: 'delivery-event' as const,
            data: event,
            timestamp: event.date
        }));
    }

    formatDateTime(dateTime: string): string {
        if (!dateTime) return 'No date';

        const date = dayjs(dateTime);
        if (!date.isValid()) return 'Invalid date';

        const now = dayjs();
        const isToday = date.isSame(now, 'day');
        const isTomorrow = date.isSame(now.add(1, 'day'), 'day');

        if (isToday) {
            return date.format('HH:mm');
        } else if (isTomorrow) {
            return `Tomorrow ${date.format('HH:mm')}`;
        } else {
            return date.format('MMM DD, HH:mm');
        }
    }

    isEventOverdue(event: DeliveryJourneyViewModel): boolean {
        if (!event.date || event.status === 'completed') {
            return false;
        }

        const eventDate = dayjs(event.date);
        const now = dayjs();
        return now.isAfter(eventDate) && event.status !== 'completed';
    }
    
    getIconColorClass(index: number): string {
        const colors = [
            'icon-color-1',
            'icon-color-2',
            'icon-color-3',
            'icon-color-4',
            'icon-color-5',
            'icon-color-6',
            'icon-color-7',
            'icon-color-8'
        ];

        return colors[index % colors.length];
    }
    
    getItemClass(item: any): string {
        return `step-item ${item.data.status}`;
    }
    
    handleDeliveryEventClick($event: MouseEvent, deliveryEvent: DeliveryJourneyViewModel) {
        $event.preventDefault();
        $event.stopPropagation();

        if (this.onDeliveryEventClick) {
            this.onDeliveryEventClick({deliveryEvent});
        }
    }

    refreshJourney() {
        this.toastrService.showInfoToast('Refreshing delivery journey...');
        this.timelineItems = [];

        // Reset animation
        this.shouldAnimate = false;

        this.registerTimeout(async () => {
            this.loadDeliveryJourney();
            this.startAnimation();
            this.toastrService.showSuccessToast('Delivery journey updated');
        }, 300);
    }

    getCompletedCount(): number {
        return this.timelineItems.length;
    }

    getEventCompletionRate(): number {
        const total = this.timelineItems.length;
        const completed = this.getCompletedCount();
        return total > 0 ? Math.round((completed / total) * 100) : 0;
    }

    getNextAction(): string {
        const overdueEvent = this.timelineItems.find(item => item.data.status === 'todo' && this.isEventOverdue(item.data));
        if (overdueEvent) {
            return `${overdueEvent.data.title} (overdue)`;
        }

        const nextTodo = this.timelineItems.find(item => item.data.status === 'todo');
        if (nextTodo) {
            return nextTodo.data.title;
        }

        const nextPending = this.timelineItems.find(item => item.data.status === 'pending');
        if (nextPending) {
            return nextPending.data.title;
        }

        return this.timelineItems.length > 0 ? 'All events completed' : 'No events available';
    }

    hasOverdueActions(): boolean {
        return this.timelineItems.some(item => item.data.status === 'todo' && this.isEventOverdue(item.data));
    }
    
    getNextTrigger(): string {
        const nextPending = this.timelineItems.find(item => item.data.status === 'pending');
        if (nextPending) {
            const eventDate = dayjs(nextPending.data.date);
            const now = dayjs();
            const diff = eventDate.diff(now, 'minute');

            if (diff > 0) {
                const hours = Math.floor(diff / 60);
                const minutes = diff % 60;
                return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
            }
        }
        return 'No upcoming triggers';
    }
}

export const TaskHistoryComponent: angular.IComponentOptions = {
    template: require("./task-history.template.html"),
    controller: TaskHistoryController,
    controllerAs: 'ctrl',
    bindings: {
        jobId: '<',
        config: '<',
        onDeliveryEventClick: '&'
    },
}