/**
 * Task Calendar View React Module
 *
 * Entry point for the React-based TaskCalendarView component.
 * Provides AngularJS integration via react2angular pattern.
 */

import React from 'react';
import {createRoot, Root} from 'react-dom/client';
import {ThemeProvider, CssBaseline} from '@mui/material';
import {TaskCalendarView} from './TaskCalendarView';
import {Task} from '../task-item/TaskItem.interfaces';
import {TasksServiceInterface} from './TaskCalendarView.interfaces';
import {getTheme} from '../../../theme/muiTheme';
import {toastService} from '../../../services/toastService';
import angular from 'angular';

/**
 * AngularJS Component Controller for React TaskCalendarView
 */
class TaskCalendarViewReactController implements angular.IController {
    static $inject = ['$element', 'tasksService'];

    private root: Root | null = null;

    // Bindings from AngularJS
    tasks?: Task[];
    onTaskUpdate?: () => void;
    onTaskClick?: (params: {task: Task}) => void;
    onTaskStatusChange?: (params: {task: Task}) => void;
    onViewChange?: (params: {startDate: Date; endDate: Date}) => void;

    constructor(
        private $element: JQLite,
        private tasksService: TasksServiceInterface
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
        if (!this.root) return;

        const currentTheme = getTheme();

        // Wrap AngularJS callbacks to match expected signatures
        const handleTaskClick = this.onTaskClick ? (task: Task) => this.onTaskClick!({task}) : undefined;

        const handleTaskStatusChange = this.onTaskStatusChange
            ? (task: Task) => this.onTaskStatusChange!({task})
            : undefined;

        const handleViewChange = this.onViewChange
            ? (startDate: Date, endDate: Date) => this.onViewChange!({startDate, endDate})
            : undefined;

        this.root.render(
            <ThemeProvider theme={currentTheme}>
                <CssBaseline />
                <TaskCalendarView
                    tasks={this.tasks || []}
                    onTaskUpdate={this.onTaskUpdate}
                    onTaskClick={handleTaskClick}
                    onTaskStatusChange={handleTaskStatusChange}
                    onViewChange={handleViewChange}
                    tasksService={this.tasksService}
                    showSuccessToast={msg => toastService.showSuccessToast(msg)}
                    showErrorToast={msg => toastService.showErrorToast(msg)}
                />
            </ThemeProvider>
        );
    }
}

/**
 * AngularJS component definition for React TaskCalendarView
 */
export const TaskCalendarViewReactComponent: angular.IComponentOptions = {
    controller: TaskCalendarViewReactController,
    bindings: {
        tasks: '<',
        onTaskUpdate: '&',
        onTaskClick: '&',
        onTaskStatusChange: '&',
        onViewChange: '&',
    },
};

export default TaskCalendarViewReactComponent;
