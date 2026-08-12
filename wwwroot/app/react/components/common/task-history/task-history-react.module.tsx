/**
 * Task History React Module
 *
 * Entry point for the React-based TaskHistory component.
 * Provides AngularJS integration via react2angular pattern.
 */

import React from 'react';
import {createRoot, Root} from 'react-dom/client';
import {TaskHistory} from './TaskHistory';
import {DeliveryJourney, DeliveryHistoryConfig} from './TaskHistory.interfaces';
import {toastService} from '../../../services/toastService';
import angular from 'angular';
import {islandTree} from '../../../theme/DfrntMantineProvider';
import {MuiThemeIsland} from '../../../components/common/mui-interop/MuiThemeIsland';

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
        // Wrap the AngularJS callback to match expected signature
        const handleDeliveryEventClick = this.onDeliveryEventClick
            ? (deliveryEvent: DeliveryJourney) => this.onDeliveryEventClick!({deliveryEvent})
            : undefined;

        this.root.render(islandTree(
            <MuiThemeIsland>
                <TaskHistory
                    jobId={this.jobId}
                    config={this.config}
                    onDeliveryEventClick={handleDeliveryEventClick}
                    showSuccessToast={(msg) => toastService.showSuccessToast(msg)}
                    showErrorToast={(msg) => toastService.showErrorToast(msg)}
                    showInfoToast={(msg) => toastService.showInfoToast(msg)}
                    isUsCustomer={this.appConfig.US_Customer}
                />

            </MuiThemeIsland>
        ));
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
