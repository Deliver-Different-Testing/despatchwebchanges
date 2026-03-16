/**
 * Task Item React Module
 *
 * Entry point for the React-based TaskItem component.
 * Provides AngularJS integration via react2angular pattern.
 */

import React from 'react';
import {createRoot, Root} from 'react-dom/client';
import {ThemeProvider} from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import {TaskItem} from './TaskItem';
import {Task, TaskItemConfig, TasksServiceInterface, DispatchServiceInterface} from './TaskItem.interfaces';
import {getTheme} from '../../../theme/muiTheme';
import {toastService} from '../../../services/toastService';
import angular from 'angular';

/**
 * AngularJS Component Controller for React TaskItem
 */
class TaskItemReactController implements angular.IController {
    static $inject = ['$element', 'tasksService', 'DispatchData'];

    private root: Root | null = null;

    // Bindings from AngularJS
    task?: Task;
    config?: TaskItemConfig;
    onTaskUpdated?: () => void;
    onTaskClick?: (params: {task: Task}) => void;

    constructor(
        private $element: JQLite,
        private tasksService: TasksServiceInterface,
        private dispatchService: DispatchServiceInterface
    ) {}

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
        const handleTaskClick = (task: Task) => {
            console.log('[TaskItemReact] Task clicked:', task.id, task.jobNumber);
            if (this.onTaskClick) {
                console.log('[TaskItemReact] Calling onTaskClick callback');
                this.onTaskClick({task});
            } else {
                console.warn('[TaskItemReact] onTaskClick callback not defined');
            }
        };

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
                    showSuccessToast={(msg) => toastService.showSuccessToast(msg)}
                    showErrorToast={(msg) => toastService.showErrorToast(msg)}
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
