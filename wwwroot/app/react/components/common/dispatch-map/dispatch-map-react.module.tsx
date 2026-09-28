/**
 * DispatchMap React Module
 *
 * Entry point for the React-based DispatchMap component.
 * Provides AngularJS integration via react2angular pattern.
 */

import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import {ThemeProvider} from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { QueryClientProvider } from '@tanstack/react-query';
import { DispatchMap } from './DispatchMap';
import type { IDispatchMapItem, ClearListEnvelopeData } from './DispatchMap.types';
import { getTheme } from '../../../theme/muiTheme';
import { queryClient } from '../../../query/queryClient';
import angular from 'angular';

/**
 * AngularJS Component Controller for React DispatchMap
 */
class DispatchMapReactController implements angular.IController {
    static $inject = ['$element', '$scope'];

    // Data bindings from AngularJS
    jobs?: IDispatchMapItem[];
    currentJob?: IDispatchMapItem;
    mapCenter?: { lat: number; lng: number };
    mapZoom?: number;
    showAvailableCouriers?: boolean;
    clearListId?: number;

    // Callback bindings from AngularJS (& binding)
    onMarkerClick?: (params: { job: IDispatchMapItem }) => void;
    onEnvelopeUpdate?: (params: { data: ClearListEnvelopeData }) => void;

    private root: Root | null = null;

    constructor(
        private $element: JQLite,
        private $scope: angular.IScope
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

        // Wrap AngularJS callbacks to run within digest cycle
        const handleMarkerClick = this.onMarkerClick
            ? (job: IDispatchMapItem) => {
                  this.$scope.$apply(() => {
                      this.onMarkerClick!({ job });
                  });
              }
            : undefined;

        const handleEnvelopeUpdate = this.onEnvelopeUpdate
            ? (data: ClearListEnvelopeData) => {
                  this.$scope.$apply(() => {
                      this.onEnvelopeUpdate!({ data });
                  });
              }
            : undefined;

        this.root.render(
            <QueryClientProvider client={queryClient}>
                <ThemeProvider theme={currentTheme}>
                    <CssBaseline />
                    <DispatchMap
                        jobs={this.jobs}
                        currentJob={this.currentJob}
                        mapCenter={this.mapCenter}
                        mapZoom={this.mapZoom}
                        onMarkerClick={handleMarkerClick}
                        showAvailableCouriers={this.showAvailableCouriers}
                        clearListId={this.clearListId}
                        onEnvelopeUpdate={handleEnvelopeUpdate}
                    />
                </ThemeProvider>
            </QueryClientProvider>
        );
    }
}

/**
 * AngularJS component definition for React DispatchMap
 */
export const DispatchMapReactComponent: angular.IComponentOptions = {
    controller: DispatchMapReactController,
    bindings: {
        // Data bindings (one-way)
        jobs: '<',
        currentJob: '<',
        mapCenter: '<',
        mapZoom: '<',
        showAvailableCouriers: '<',
        clearListId: '<',
        // Callback bindings (expression)
        onMarkerClick: '&',
        onEnvelopeUpdate: '&',
    },
};

export default DispatchMapReactComponent;
