import BaseController from "../../base-controller";
import {ExtendedTask, TaskViewModel} from "../../task-dashboard/task-dashboard.interfaces";
import {SelectDialogService} from "../../dialogs/select-dialog/select-dialog.service";
import {EditDateTimeDialogService} from "../../dialogs/edit-date-time-dialog/edit-date-time-dialog.service";
import DispatchCoreService from "../../../services/dispatch-core.service";
import {IDialogDateTimeResult, ISelectDialogResult} from "../../../interfaces/dialog-result.interfaces";
import {ITaskListItemConfig} from "./task-item.interfaces";
import ToastrService from "../../../services/toastr.service";
import "./task-item.styles.less";
import {AppConfig} from "../../../interfaces/app-config.interface";

export class TaskListItemController extends BaseController {
    readonly isUsCustomer: boolean = false;
    static $inject = [
        'selectDialogService',
        'editDateTimeDialogService',
        'toastrService',
        'DispatchData',
        '$http',
        'APP_CONFIG'
    ];

    task?: ExtendedTask;
    config?: ITaskListItemConfig;
    onTaskUpdated?: () => void;
    onTaskClick?: (params: { task: ExtendedTask }) => void;
    timeZone: string;

    constructor(
        private selectDialogService: SelectDialogService,
        private editDateTimeDialogService: EditDateTimeDialogService,
        private toastrService: ToastrService,
        private DispatchService: DispatchCoreService,
        private $http: angular.IHttpService,
        AppConfig: AppConfig
    ) {
        super();

        this.isUsCustomer = AppConfig.US_Customer;
        this.timeZone = TimeZone;

        // Default configuration
        this.config = {
            showJobId: true,
            showAssignee: true,
            showJobType: true,
            showDateTime: true,
            showStatusIndicators: true,
            allowCompletion: true,
            showOverdueWarning: true,
            onTaskClick: true
        };
    }

    async openDateDialog($event: MouseEvent, task: TaskViewModel) {
        $event.preventDefault();
        $event.stopPropagation();

        try {
            const result: IDialogDateTimeResult = await this.editDateTimeDialogService.showEditDateDialog(
                $event, "Due Date", "dueDate", new Date(task.dueDate));

            await this._updateTaskDate(task.id, result.formattedDateTime);
            task.dueDate = result.formattedDateTime;

            this.toastrService.showSuccessToast("Task date updated successfully");

            if (this.onTaskUpdated) {
                this.onTaskUpdated();
            }
        } catch (error) {
            this._handleError(error);
        }
    }

    async openTimeDialog($event: MouseEvent, task: TaskViewModel) {
        $event.preventDefault();
        $event.stopPropagation();

        try {
            const result: IDialogDateTimeResult = await this.editDateTimeDialogService.showEditTimeDialog(
                $event, "Due Time", "dueDate", new Date(task.dueDate));

            await this._updateTaskTime(task.id, result.formattedDateTime);
            task.dueDate = result.formattedDateTime;

            this.toastrService.showSuccessToast("Task time updated successfully");

            if (this.onTaskUpdated) {
                this.onTaskUpdated();
            }
        } catch (error) {
            this._handleError(error);
        }
    }

    async reassignTask($event: MouseEvent, task: TaskViewModel) {
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

    async handleTaskCompletion(task: TaskViewModel) {
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

    isTaskOverdue(task: TaskViewModel): boolean {
        if (task.closed) return false;
        return new Date(task.dueDate) < new Date();
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

        this.toastrService.showErrorToast("Error updating task");
    }

    handleTaskClick($event: MouseEvent) {
        console.log('[TaskListItemController.handleTaskClick] Starting click handler');
        if (this.config?.onTaskClick && this.onTaskClick && this.task) {
            console.log('[TaskListItemController.handleTaskClick] Conditions met, executing onTaskClick with task:', this.task);
            $event.stopPropagation();
            this.onTaskClick({ task: this.task });
        } else {
            console.log('[TaskListItemController.handleTaskClick] Click handler conditions not met', {
                hasConfigOnTaskClick: !!this.config?.onTaskClick,
                hasOnTaskClick: !!this.onTaskClick,
                hasTask: !!this.task
            });
        }
    }
}

export const TaskItemComponent: angular.IComponentOptions = {
    template: require("./task-item.template.html"),
    controller: TaskListItemController,
    controllerAs: 'ctrl',
    bindings: {
        task: '<',
        config: '<',
        onTaskUpdated: '&',
        onTaskClick: '&'
    },
}
