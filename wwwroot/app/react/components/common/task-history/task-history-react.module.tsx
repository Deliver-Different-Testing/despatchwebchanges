/**
 * Task History React Module
 *
 * Entry point for the React-based TaskHistory component.
 * Provides AngularJS integration via react2angular pattern.
 */

import React from 'react';
import {createRoot, Root} from 'react-dom/client';
import {QueryClientProvider} from '@tanstack/react-query';
import {ThemeProvider} from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import {TaskHistory} from './TaskHistory';
import {DeliveryJourney, DeliveryHistoryConfig} from './TaskHistory.interfaces';
import {getTheme} from '../../../theme/muiTheme';
import {queryClient} from '../../../query/queryClient';
import {toastService} from '../../../services/toastService';
import angular from 'angular';

/**
 * AngularJS Component Controller for React TaskHistory
 */
class TaskHistoryReactController implements angular.IController {
    static $inject = ['$element', 'APP_CONFIG'];

    private root: Root | null = null;

    // Bindings from AngularJS
    jobId?: number;
    config?: DeliveryHistoryConfig;
    onDeliveryEventClick?: (params: {deliveryEvent: DeliveryJourney}) => void;

    constructor(
        private $element: JQLite,
        private appConfig: {US_Customer: boolean}
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

        // Wrap the AngularJS callback to match expected signature
        const handleDeliveryEventClick = this.onDeliveryEventClick
            ? (deliveryEvent: DeliveryJourney) => this.onDeliveryEventClick!({deliveryEvent})
            : undefined;

        this.root.render(
            <QueryClientProvider client={queryClient}>
                <ThemeProvider theme={currentTheme}>
                    <CssBaseline />
                    <TaskHistory
                        jobId={this.jobId}
                        config={this.config}
                        onDeliveryEventClick={handleDeliveryEventClick}
                        showSuccessToast={(msg) => toastService.showSuccessToast(msg)}
                        showErrorToast={(msg) => toastService.showErrorToast(msg)}
                        showInfoToast={(msg) => toastService.showInfoToast(msg)}
                        isUsCustomer={this.appConfig.US_Customer}
                    />
                </ThemeProvider>
            </QueryClientProvider>
        );
    }
}

/**
 * AngularJS component definition for React TaskHistory
 */
export const TaskHistoryReactComponent: angular.IComponentOptions = {
    controller: TaskHistoryReactController,
    bindings: {
        jobId: '<',
        config: '<',
        onDeliveryEventClick: '&',
    },
};

export default TaskHistoryReactComponent;
