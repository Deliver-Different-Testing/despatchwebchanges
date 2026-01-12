/**
 * Task Item React Module
 *
 * Entry point for the React-based TaskItem component.
 * Provides AngularJS integration via react2angular pattern.
 */

import React from 'react';
import {createRoot, Root} from 'react-dom/client';
import {ThemeProvider, CssBaseline} from '@mui/material';
import {TaskItem} from './TaskItem';
import {Task, TaskItemConfig, TasksServiceInterface, DispatchServiceInterface} from './TaskItem.interfaces';
import {getTheme} from '../../../theme/muiTheme';
import {toastService} from '../../../services/toastService';
import ToastrService from "../../../../services/toastr.service";

/**
 * AngularJS Component Controller for React TaskItem
 */
class TaskItemReactController implements angular.IController {
    static $inject = ['$element', 'tasksService', 'DispatchData', 'toastrService'];

    private root: Root | null = null;

    // Bindings from AngularJS
    task?: Task;
    config?: TaskItemConfig;
    onTaskUpdated?: () => void;
    onTaskClick?: (params: {task: Task}) => void;

    constructor(
        private $element: JQLite,
        private tasksService: TasksServiceInterface,
        private dispatchService: DispatchServiceInterface,
        private angularToastrService: ToastrService
    ) {
        // Set the angular toastr for the standalone toast service
        toastService.setAngularToastr(angularToastrService);
    }

    $onInit(): void {
        this.root = createRoot(this.$element[0]);
        this.render();
    }

    $onChanges(): void {
        this.render();
    }

    $onDestroy(): void {
        if (this.root) {
            this.root.unmount();
            this.root = null;
        }
    }

    private render(): void {
        if (!this.root || !this.task) return;

        const currentTheme = getTheme();

        // Wrap the AngularJS callback to match expected signature
        const handleTaskClick = this.onTaskClick
            ? (task: Task) => this.onTaskClick!({task})
            : undefined;

        this.root.render(
            <ThemeProvider theme={currentTheme}>
                <CssBaseline />
                <TaskItem
                    task={this.task}
                    config={this.config}
                    onTaskUpdated={this.onTaskUpdated}
                    onTaskClick={handleTaskClick}
                    tasksService={this.tasksService}
                    dispatchService={this.dispatchService}
                    showSuccessToast={(msg) => this.angularToastrService.showSuccessToast(msg)}
                    showErrorToast={(msg) => this.angularToastrService.showErrorToast(msg)}
                />
            </ThemeProvider>
        );
    }
}

/**
 * AngularJS component definition for React TaskItem
 */
export const TaskItemReactComponent: angular.IComponentOptions = {
    controller: TaskItemReactController,
    bindings: {
        task: '<',
        config: '<',
        onTaskUpdated: '&',
        onTaskClick: '&',
    },
};

// Register as AngularJS module
const taskItemReactModule = (window as any).angular.module(
    'uDispatch.taskItemReact',
    []
);

taskItemReactModule.component('taskItemReact', TaskItemReactComponent);

console.log('[TaskItemReact] Module registered');

export default taskItemReactModule;
