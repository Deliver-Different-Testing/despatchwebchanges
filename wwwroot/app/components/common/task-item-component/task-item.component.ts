import BaseController from "../../base-controller";
import {ExtendedTask, Task} from "../../task-dashboard/task-dashboard.interfaces";
import "./task-item.styles.less";

export interface TaskListItemBindings {
    task: ExtendedTask;
    onStatusChange: (params: { task: Task }) => void;
    onDateClick: (params: { $event: MouseEvent, task: Task }) => void;
    onTimeClick: (params: { $event: MouseEvent, task: Task }) => void;
    onReassign: (params: { $event: MouseEvent, task: Task }) => void;
}

export class TaskListItemController extends BaseController {
    static $inject = ['$filter'];

    task?: ExtendedTask;
    onStatusChange?: (params: { task: Task }) => void;
    onDateClick?: (params: { $event: MouseEvent, task: Task }) => void;
    onTimeClick?: (params: { $event: MouseEvent, task: Task }) => void;
    onReassign?: (params: { $event: MouseEvent, task: Task }) => void;

    constructor(private $filter: angular.IFilterService) {
        super();
    }

    $onInit(): void {
        // Component initialization logic if needed
    }

    handleTaskCompletion(task: Task): void {
        if (this.onStatusChange) {
            this.onStatusChange({ task: task });
        }
    }

    openDateDialog($event: MouseEvent, task: Task): void {
        $event.preventDefault();
        $event.stopPropagation();

        if (this.onDateClick) {
            this.onDateClick({ $event: $event, task: task });
        }
    }

    openTimeDialog($event: MouseEvent, task: Task): void {
        $event.preventDefault();
        $event.stopPropagation();

        if (this.onTimeClick) {
            this.onTimeClick({ $event: $event, task: task });
        }
    }

    reassignTask($event: MouseEvent, task: Task): void {
        $event.stopPropagation();

        if (this.onReassign) {
            this.onReassign({ $event: $event, task: task });
        }
    }

    isTaskOverdue(task: Task): boolean {
        if (task.closed) return false;
        return new Date(task.dueDate) < new Date();
    }

    formatDate(date: string): string {
        return this.$filter('date')(date, 'MMM d, yyyy');
    }

    formatTime(date: string): string {
        return this.$filter('date')(date, 'h:mm a');
    }
}

export const TaskItemComponent: angular.IComponentOptions = {
    template: require("./task-item.template.html"),
    controller: TaskListItemController,
    controllerAs: 'ctrl',
    bindings: {
        task: '<',
        onStatusChange: '&',
        onDateClick: '&',
        onTimeClick: '&',
        onReassign: '&'
    },
}
