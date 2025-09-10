import BaseController from "../../base-controller";
import {ExtendedTask, TaskViewModel} from "../../task-dashboard/task-dashboard.interfaces";
import {SelectDialogService} from "../../dialogs/select-dialog/select-dialog.service";
import {EditDateTimeDialogService} from "../../dialogs/edit-date-time-dialog/edit-date-time-dialog.service";
import DispatchCoreService from "../../../services/dispatch-core.service";
import {IDialogDateTimeResult, ISelectDialogResult} from "../../../interfaces/dialog-result.interfaces";
import {ITaskListItemConfig} from "./task-item.interfaces";
import ToastrService from "../../../services/toastr.service";
import "./task-item.styles.less";
import {IAppConfig} from "../../../interfaces/app-config.interface";
import dayjs from "dayjs";
import TasksService from "../../../services/tasks.service";

class TaskListItemController extends BaseController {
    static $inject = [
        '$log',
        'selectDialogService',
        'editDateTimeDialogService',
        'toastrService',
        'DispatchData',
        'tasksService',
        '$timeout',
        '$interval',
        'APP_CONFIG',
    ];

    readonly isUsCustomer: boolean = false;
    task?: ExtendedTask;
    config?: ITaskListItemConfig;
    onTaskUpdated?: () => void;
    onTaskClick?: (params: { task: ExtendedTask }) => void;
    timeZone: string;

    constructor(
        private $log: angular.ILogService,
        private selectDialogService: SelectDialogService,
        private editDateTimeDialogService: EditDateTimeDialogService,
        private toastrService: ToastrService,
        private DispatchService: DispatchCoreService,
        private tasksService: TasksService,
        $timeout: angular.ITimeoutService,
        $interval: angular.IIntervalService,
        appConfig: IAppConfig
    ) {
        super();

        // Initialize the BaseController services
        this.initServices($timeout, $interval);

        this.isUsCustomer = appConfig.US_Customer;
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
                $event, "Due Date", "dueDate", dayjs(task.dueDate).toDate());

            await this.tasksService.updateTaskDate(task.id, result.value);

            this.registerTimeout(() => {
                task.dueDate = result.value;
                this.toastrService.showSuccessToast("Task date updated successfully");

                if (this.onTaskUpdated) {
                    this.onTaskUpdated();
                }
            });
        } catch (error) {
            this.handleError(error);
        }
    }

    async openTimeDialog($event: MouseEvent, task: TaskViewModel) {
        $event.preventDefault();
        $event.stopPropagation();

        try {
            const result: IDialogDateTimeResult = await this.editDateTimeDialogService.showEditTimeDialog(
                $event, "Due Time", "dueDate", dayjs(task.dueDate).toDate());

            await this.tasksService.updateTaskTime(task.id, result.value);

            this.registerTimeout(() => {
                task.dueDate = result.value;
                this.toastrService.showSuccessToast("Task time updated successfully");

                if (this.onTaskUpdated) {
                    this.onTaskUpdated();
                }
            });
        } catch (error) {
            this.handleError(error);
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

            await this.tasksService.reassignTaskToStaff(task.id, result.value);

            this.registerTimeout(() => {
                this.toastrService.showSuccessToast("Task reassigned successfully");

                if (this.onTaskUpdated) {
                    this.onTaskUpdated();
                }
            });
        } catch (error) {
            this.handleError(error);
        }
    }

    async handleTaskCompletion(task: TaskViewModel) {
        try {
            await this.tasksService.markTaskAsClosed(task.id, task.closed);

            this.registerTimeout(() => {
                this.toastrService.showSuccessToast("Task completed successfully");

                if (this.onTaskUpdated) {
                    this.onTaskUpdated();
                }
            });
        } catch (error) {
            this.registerTimeout(() => {
                task.closed = !task.closed;
                this.handleError(error);
            });
        }
    }

    isTaskOverdue(task: TaskViewModel): boolean {
        if (task.closed) return false;
        return dayjs(task.dueDate).isBefore(dayjs());
    }

    private handleError(error: any) {
        if (!error) {
            this.$log.debug("Dialog Closed");
            return;
        }

        this.toastrService.showErrorToast("Error updating task");
    }

    handleTaskClick($event: MouseEvent) {
        this.$log.debug('[TaskListItemController.handleTaskClick] Starting click handler');
        if (this.config?.onTaskClick && this.onTaskClick && this.task) {
            this.$log.debug('[TaskListItemController.handleTaskClick] Conditions met, executing onTaskClick with task:', this.task);
            $event.stopPropagation();
            this.onTaskClick({task: this.task});
        } else {
            this.$log.debug('[TaskListItemController.handleTaskClick] Click handler conditions not met', {
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
