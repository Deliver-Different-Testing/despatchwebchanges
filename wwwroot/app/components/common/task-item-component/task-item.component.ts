import BaseController from "../../base-controller";
import {ExtendedTask, Task} from "../../task-dashboard/task-dashboard.interfaces";
import {SelectDialogService} from "../../dialogs/select-dialog/select-dialog.service";
import {EditDateTimeDialogService} from "../../dialogs/edit-date-time-dialog/edit-date-time-dialog.service";
import DispatchCoreService from "../../../services/dispatch-core.service";
import {IDialogDateTimeResult, ISelectDialogResult} from "../../../interfaces/dialog-result.interfaces";
import {ITaskListItemConfig} from "./task-item.interfaces";
import ToastrService from "../../../services/toastr.service";
import "./task-item.styles.less";

export interface TaskListItemBindings {
    task: ExtendedTask;
    config: ITaskListItemConfig;
    onTaskUpdated: () => void;
}

export class TaskListItemController extends BaseController {
    static $inject = [
        '$filter',
        'selectDialogService',
        'editDateTimeDialogService',
        'toastrService',
        'DispatchData',
        '$http'
    ];

    task?: ExtendedTask;
    config?: ITaskListItemConfig;
    onStatusChange?: (params: { task: Task }) => void;
    onTaskUpdated?: () => void;

    constructor(
        private $filter: angular.IFilterService,
        private selectDialogService: SelectDialogService,
        private editDateTimeDialogService: EditDateTimeDialogService,
        private toastrService: ToastrService,
        private DispatchService: DispatchCoreService,
        private $http: angular.IHttpService
    ) {
        super();
    }

    $onInit() {
        // Set default configuration if not provided
        if (!this.config) {
            this.config = {
                showJobId: true,
                showAssignee: true,
                showJobType: true,
                showDateTime: true,
                customClass: '',
                showStatusIndicators: true,
                allowCompletion: true,
                showOverdueWarning: true,
                dateFormat: 'MMM d, yyyy',
                timeFormat: 'h:mm a'
            };
        }
    }

    async openDateDialog($event: MouseEvent, task: Task) {
        $event.preventDefault();
        $event.stopPropagation();

        try {
            const result: IDialogDateTimeResult = await this.editDateTimeDialogService.showEditDateDialog(
                $event, "Due Date", "dueDate", new Date(task.dueDate));

            // Update task date via task service
            await this._updateTaskDate(task.id, result.formattedDateTime);

            // Update local task object
            task.dueDate = result.formattedDateTime;

            this.toastrService.showSuccessToast("Task date updated successfully");

            if (this.onTaskUpdated) {
                this.onTaskUpdated();
            }
        } catch (error) {
            this._handleError(error);
        }
    }

    async openTimeDialog($event: MouseEvent, task: Task) {
        $event.preventDefault();
        $event.stopPropagation();

        try {
            const result: IDialogDateTimeResult = await this.editDateTimeDialogService.showEditTimeDialog(
                $event, "Due Time", "dueDate", new Date(task.dueDate));

            // Update task time via task service
            await this._updateTaskTime(task.id, result.formattedDateTime);

            // Update local task object
            task.dueDate = result.formattedDateTime;

            this.toastrService.showSuccessToast("Task time updated successfully");

            if (this.onTaskUpdated) {
                this.onTaskUpdated();
            }
        } catch (error) {
            this._handleError(error);
        }
    }

    async reassignTask($event: MouseEvent, task: Task) {
        $event.stopPropagation();

        try {
            const users = await this.DispatchService.getActiveStaff();
            const result: ISelectDialogResult = await this.selectDialogService.showSelectDialog(
                $event,
                users,
                "assignTask",
                "Reassign Task",
                task.assignee.id
            );

            await this._reassignTaskToStaff(task.id, result.value);
            this.toastrService.showSuccessToast("Task reassigned successfully");

            if (this.onTaskUpdated) {
                this.onTaskUpdated();
            }
        } catch (error) {
            this._handleError(error);
        }
    }

    async handleTaskCompletion(task: Task) {
        try {
            await this.$http.post("Task/MarkTaskAsClosed" + "?eventId=" + task.id + "&closed=" + task.closed, null);

            this.toastrService.showSuccessToast("Task completed successfully");

            if (this.onTaskUpdated) {
                this.onTaskUpdated();
            }
        } catch (error) {
            task.closed = !task.closed;
            this._handleError(error);
        }
    }

    isTaskOverdue(task: Task): boolean {
        if (task.closed) return false;
        return new Date(task.dueDate) < new Date();
    }

    formatDate(date: string): string {
        const format = this.config?.dateFormat || 'MMM d, yyyy';
        return this.$filter('date')(date, format);
    }

    formatTime(date: string): string {
        const format = this.config?.timeFormat || 'h:mm a';
        return this.$filter('date')(date, format);
    }

    private async _updateTaskDate(eventId: number, date: string) {
        await this.$http.post("Task/UpdateTaskDate" + "?eventId=" + eventId + "&date=" + date, null);
    }

    private async _updateTaskTime(eventId: number, time: string) {
        await this.$http.post("Task/UpdateTaskTime" + "?eventId=" + eventId + "&time=" + time, null);
    }

    private async _reassignTaskToStaff(eventId: number, staffId: number) {
        await this.$http.post("Task/ReassignTask" + "?eventId=" + eventId + "&staffId=" + staffId, null);
    }

    private _handleError(error: any) {
        if(!error) {
            console.log("Dialog Closed")
            return;
        }

        // Actual error occured
        this.toastrService.showErrorToast("Error updating task");
    }
}

export const TaskItemComponent: angular.IComponentOptions = {
    template: require("./task-item.template.html"),
    controller: TaskListItemController,
    controllerAs: 'ctrl',
    bindings: {
        task: '<',
        config: '<',
        onTaskUpdated: '&'
    },
}
