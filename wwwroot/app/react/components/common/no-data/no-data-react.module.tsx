/**
 * No Data React Module
 *
 * Entry point for the React-based NoData component.
 * Provides AngularJS integration via react2angular pattern.
 */

import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { NoData } from './NoData';
import { getTheme } from '../../../theme/muiTheme';
import {IAppConfig} from "../../../../interfaces/app-config.interface";
import angular from 'angular';

/**
 * AngularJS Component Controller for React NoData
 */
class NoDataReactController implements angular.IController {
    static $inject = ['$element', 'APP_CONFIG'];

    private root: Root | null = null;
    private readonly isUsCustomer: boolean;

    // Data bindings from AngularJS (@ bindings - string interpolation)
    title?: string;
    message?: string;
    icon?: string;
    showAction?: string | boolean;
    actionText?: string;

    // Callback bindings from AngularJS (& binding)
    onAction?: () => void;

    constructor(
        private $element: JQLite,
        appConfig: IAppConfig
    ) {
        this.isUsCustomer = appConfig.US_Customer;
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

        // Wrap AngularJS callback to match React expected signature
        const handleAction = this.onAction
            ? () => this.onAction!()
            : undefined;

        // Convert showAction from string to boolean (legacy compatibility)
        let showActionBool = false;
        if (typeof this.showAction === 'string') {
            showActionBool = this.showAction.toLowerCase() === 'true';
        } else if (typeof this.showAction === 'boolean') {
            showActionBool = this.showAction;
        }

        this.root.render(
            <ThemeProvider theme={currentTheme}>
                <CssBaseline />
                <NoData
                    title={this.title}
                    message={this.message}
                    icon={this.icon}
                    showAction={showActionBool}
                    actionText={this.actionText}
                    onAction={handleAction}
                    isUsCustomer={this.isUsCustomer}
                />
            </ThemeProvider>
        );
    }
}

/**
 * AngularJS component definition for React NoData
 */
export const NoDataReactComponent: angular.IComponentOptions = {
    controller: NoDataReactController,
    bindings: {
        // String bindings (@ - interpolated strings, matching legacy component)
        title: '@?',
        message: '@?',
        icon: '@?',
        showAction: '@?',
        actionText: '@?',
        // Callback bindings (expression)
        onAction: '&?',
    },
};

export default NoDataReactComponent;
