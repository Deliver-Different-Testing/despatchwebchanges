import "./task-history.styles.less";
import BaseController from "../../base-controller";
import {IDeliveryHistoryConfig, IDeliveryJourney} from "./task-history.interfaces";
import ToastrService from "../../../services/toastr.service";
import {IAppConfig} from "../../../interfaces/app-config.interface";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import DispatchCoreService from "../../../services/dispatch-core.service";
import DensityMode from "../../../enums/densityMode";

dayjs.extend(relativeTime);

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
    onDeliveryEventClick?: (params: { deliveryEvent: IDeliveryJourney }) => void;
    timeZoneShort: string;
    shouldAnimate: boolean = false;

    // Journey data
    deliveryEvents: IDeliveryJourney[] = [];

    historyLoading?: boolean;
    densityMode: DensityMode = DensityMode.Normal;

    constructor(
        private toastrService: ToastrService,
        private DispatchData: DispatchCoreService,
        $timeout: angular.ITimeoutService,
        $interval: angular.IIntervalService,
        appConfig: IAppConfig
    ) {
        super();

        this.initServices($timeout, $interval);
        this.isUsCustomer = appConfig.US_Customer;
        this.timeZoneShort = this.getShortTimeZoneString();
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
                this.deliveryEvents = deliveryJourney;
            })
            .catch((error) => {
                console.error('Error loading delivery journey:', error);
                this.toastrService.showErrorToast('Failed to load delivery journey');
                this.initializeEmptyData();
            })
            .finally(() => {
                this.historyLoading = false;
                console.info('Delivery journey loaded');
            });
    }

    private initializeEmptyData() {
        this.deliveryEvents = [];
    }

    isEventOverdue(event: IDeliveryJourney): boolean {
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

    getItemClass(event: IDeliveryJourney): string {
        return `step-item ${event.status}`;
    }

    handleDeliveryEventClick($event: MouseEvent, deliveryEvent: IDeliveryJourney) {
        $event.preventDefault();
        $event.stopPropagation();

        if (this.onDeliveryEventClick) {
            this.onDeliveryEventClick({deliveryEvent});
        }
    }

    refreshJourney() {
        this.toastrService.showInfoToast('Refreshing delivery journey...');
        this.deliveryEvents = [];

        // Reset animation
        this.shouldAnimate = false;

        this.registerTimeout(async () => {
            this.loadDeliveryJourney();
            this.startAnimation();
            this.toastrService.showSuccessToast('Delivery journey updated');
        }, 300);
    }

    getCompletedCount(): number {
        return this.deliveryEvents.filter(event => event.status === 'completed').length;
    }

    getEventCompletionRate(): number {
        const total = this.deliveryEvents.length;
        const completed = this.getCompletedCount();
        return total > 0 ? Math.round((completed / total) * 100) : 0;
    }

    getNextAction(): string {
        const overdueEvent = this.deliveryEvents.find(event =>
            event.status === 'todo' && this.isEventOverdue(event)
        );
        if (overdueEvent) {
            return `${overdueEvent.title} (overdue)`;
        }

        const nextTodo = this.deliveryEvents.find(event => event.status === 'todo');
        if (nextTodo) {
            return nextTodo.title;
        }

        const nextPending = this.deliveryEvents.find(event => event.status === 'pending');
        if (nextPending) {
            return nextPending.title;
        }

        return this.deliveryEvents.length > 0 ? 'All events completed' : 'No events available';
    }

    hasOverdueActions(): boolean {
        return this.deliveryEvents.some(event =>
            event.status === 'todo' && this.isEventOverdue(event)
        );
    }

    getNextTrigger(): string {
        const nextPending = this.deliveryEvents.find(event => event.status === 'pending');
        if (nextPending) {
            const eventDate = dayjs(nextPending.date);
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