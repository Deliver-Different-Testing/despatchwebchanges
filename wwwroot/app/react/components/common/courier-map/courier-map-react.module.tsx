/**
 * CourierMap React Module
 *
 * Entry point for the React-based CourierMap component.
 * Provides AngularJS integration via react2angular pattern.
 */

import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { QueryClientProvider } from '@tanstack/react-query';
import { CourierMap } from './CourierMap';
import { getTheme } from '../../../theme/muiTheme';
import { queryClient } from '../../../query/queryClient';

/**
 * AngularJS Component Controller for React CourierMap
 */
class CourierMapReactController implements angular.IController {
    static $inject = ['$element', '$scope', 'configService', 'APP_CONFIG'];

    // Data bindings from AngularJS
    private root: Root | null = null;
    private apiKey: string | null = null;

    constructor(
        private $element: JQLite,
        private $scope: angular.IScope,
        private configService: any,
        private appConfig: any
    ) {}

    async $onInit(): Promise<void> {
        this.root = createRoot(this.$element[0]);

        // Fetch HERE Maps API key
        try {
            this.apiKey = await this.configService.getHereMapsKey();
        } catch (error) {
            console.error('Failed to get HERE Maps API key:', error);
        }

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
        const isUsCustomer = this.appConfig?.US_Customer ?? false;
        const mapCenter = isUsCustomer
            ? this.appConfig?.US_Coordinates_Center ?? { lat: 39.8097343, lng: -98.5556199 }
            : this.appConfig?.NZ_Coordinates_Center ?? { lat: -41.2865, lng: 174.7762 };

        this.root.render(
            <QueryClientProvider client={queryClient}>
                <ThemeProvider theme={currentTheme}>
                    <CssBaseline />
                    <CourierMap
                        isUsCustomer={isUsCustomer}
                        mapCenter={mapCenter}
                        apiKey={this.apiKey}
                    />
                </ThemeProvider>
            </QueryClientProvider>
        );
    }
}

/**
 * AngularJS component definition for React CourierMap
 */
export const CourierMapReactComponent: angular.IComponentOptions = {
    controller: CourierMapReactController,
    bindings: {},
};

export default CourierMapReactComponent;
