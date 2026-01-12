/**
 * Task History React Module
 *
 * Entry point for the React-based TaskHistory component.
 * Provides AngularJS integration via react2angular pattern.
 */

import React from 'react';
import {createRoot, Root} from 'react-dom/client';
import {ThemeProvider, CssBaseline} from '@mui/material';
import {TaskHistory} from './TaskHistory';
import {DeliveryJourney, DeliveryHistoryConfig, DispatchServiceInterface} from './TaskHistory.interfaces';
import {getTheme} from '../../../theme/muiTheme';
import {toastService} from '../../../services/toastService';

/**
 * AngularJS Component Controller for React TaskHistory
 */
class TaskHistoryReactController implements angular.IController {
    static $inject = ['$element', 'DispatchData', 'toastrService', 'APP_CONFIG'];

    private root: Root | null = null;

    // Bindings from AngularJS
    jobId?: number;
    config?: DeliveryHistoryConfig;
    onDeliveryEventClick?: (params: {deliveryEvent: DeliveryJourney}) => void;

    constructor(
        private $element: JQLite,
        private dispatchService: DispatchServiceInterface,
        private angularToastrService: any,
        private appConfig: {US_Customer: boolean}
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
        if (!this.root) return;

        const currentTheme = getTheme();

        // Wrap the AngularJS callback to match expected signature
        const handleDeliveryEventClick = this.onDeliveryEventClick
            ? (deliveryEvent: DeliveryJourney) => this.onDeliveryEventClick!({deliveryEvent})
            : undefined;

        this.root.render(
            <ThemeProvider theme={currentTheme}>
                <CssBaseline />
                <TaskHistory
                    jobId={this.jobId}
                    config={this.config}
                    onDeliveryEventClick={handleDeliveryEventClick}
                    dispatchService={this.dispatchService}
                    showSuccessToast={(msg) => this.angularToastrService.showSuccessToast(msg)}
                    showErrorToast={(msg) => this.angularToastrService.showErrorToast(msg)}
                    showInfoToast={(msg) => this.angularToastrService.showInfoToast(msg)}
                    isUsCustomer={this.appConfig.US_Customer}
                />
            </ThemeProvider>
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
