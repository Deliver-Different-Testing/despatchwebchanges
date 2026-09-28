/**
 * HereMap React Module
 *
 * Entry point for the React-based HereMap component.
 * Provides AngularJS integration via react2angular pattern.
 */

import React from 'react';
import {createRoot, Root} from 'react-dom/client';
import {ThemeProvider} from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import {HereMap} from './HereMap';
import type {HereMapConfig, HereMapCredentials,} from './HereMap.types';
import {getTheme} from '../../../theme/muiTheme';
import angular from 'angular';

/**
 * AngularJS Component Controller for React HereMap
 */
class HereMapReactController implements angular.IController {
    static $inject = ['$element', '$scope'];
    // Data bindings from AngularJS
    mapId?: string;
    credentials?: HereMapCredentials;
    config?: HereMapConfig;
    // Callback bindings from AngularJS (& binding)
    onMapReady?: (params: { map: any; platform: any }) => void;
    private root: Root | null = null;

    constructor(
        private $element: JQLite,
        private $scope: angular.IScope
    ) {
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
        // and ensure it runs within Angular's digest cycle
        const handleMapReady = this.onMapReady
            ? (params: { map: any; platform: any }) => {
                this.$scope.$apply(() => {
                    this.onMapReady!(params);
                });
            }
            : undefined;

        this.root.render(
            <ThemeProvider theme={currentTheme}>
                <CssBaseline/>
                <HereMap
                    mapId={this.mapId || 'here-map'}
                    credentials={this.credentials}
                    config={this.config}
                    onMapReady={handleMapReady}
                />
            </ThemeProvider>
        );
    }
}

/**
 * AngularJS component definition for React HereMap
 */
export const HereMapReactComponent: angular.IComponentOptions = {
    controller: HereMapReactController,
    bindings: {
        // String binding for map container ID
        mapId: '@',
        // Data bindings (one-way)
        credentials: '<',
        config: '<',
        // Callback bindings (expression)
        onMapReady: '&',
    },
};

export default HereMapReactComponent;
