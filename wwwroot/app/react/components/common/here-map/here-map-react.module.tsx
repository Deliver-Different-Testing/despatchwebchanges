/**
 * HereMap React Module
 *
 * Entry point for the React-based HereMap component.
 * Provides AngularJS integration via react2angular pattern.
 */

import React from 'react';
import {createRoot, Root} from 'react-dom/client';
import {HereMap} from './HereMap';
import type {HereMapConfig, HereMapCredentials,} from './HereMap.types';
import angular from 'angular';
import {islandTree} from '../../../theme/DfrntMantineProvider';

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
        // Wrap AngularJS callback to match React expected signature
        // and ensure it runs within Angular's digest cycle
        const handleMapReady = this.onMapReady
            ? (params: { map: any; platform: any }) => {
                this.$scope.$apply(() => {
                    this.onMapReady!(params);
                });
            }
            : undefined;

        this.root.render(islandTree(
        <HereMap
            mapId={this.mapId || 'here-map'}
            credentials={this.credentials}
            config={this.config}
            onMapReady={handleMapReady}
        />

        ));
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
