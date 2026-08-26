/**
 * Driver Locations React Module
 *
 * Entry point for the React-based DriverLocations component.
 * Provides AngularJS integration via react2angular pattern.
 */

import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { DriverLocations } from './DriverLocations';
import type {
    IClearListViewModelWithColumns,
    IAreaClearList,
    ICourierData,
    TruckMode,
} from './DriverLocations.types';
import angular from 'angular';
import {islandTree} from '../../../theme/DfrntMantineProvider';

/**
 * AngularJS Component Controller for React DriverLocations
 */
class DriverLocationsReactController implements angular.IController {
    static $inject = ['$element'];

    private root: Root | null = null;

    // Data bindings from AngularJS
    driverLocations?: IClearListViewModelWithColumns;
    loading?: boolean;
    showNoData?: boolean;
    showData?: boolean;
    truckMode?: TruckMode;
    activeAreaId?: number;
    isUsCustomer?: boolean;

    // Callback bindings from AngularJS (& binding)
    onAreaClick?: (params: { area: IAreaClearList }) => void;
    onCourierClick?: (params: { courier: ICourierData }) => void;
    onClearFilter?: () => void;

    constructor(
        private $element: JQLite
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
        // Wrap AngularJS callbacks to match React expected signatures
        const handleAreaClick = this.onAreaClick
            ? (area: IAreaClearList) => this.onAreaClick!({ area })
            : undefined;

        const handleCourierClick = this.onCourierClick
            ? (courier: ICourierData) => this.onCourierClick!({ courier })
            : undefined;

        const handleClearFilter = this.onClearFilter
            ? () => this.onClearFilter!()
            : undefined;

        this.root.render(islandTree(
        <DriverLocations
            driverLocations={this.driverLocations}
            loading={this.loading}
            showNoData={this.showNoData}
            showData={this.showData}
            truckMode={this.truckMode}
            activeAreaId={this.activeAreaId}
            onAreaClick={handleAreaClick}
            onCourierClick={handleCourierClick}
            onClearFilter={handleClearFilter}
            isUsCustomer={this.isUsCustomer}
        />

        ));
    }
}

/**
 * AngularJS component definition for React DriverLocations
 */
export const DriverLocationsReactComponent: angular.IComponentOptions = {
    controller: DriverLocationsReactController,
    bindings: {
        // Data bindings (one-way)
        driverLocations: '<',
        loading: '<',
        showNoData: '<',
        showData: '<',
        truckMode: '<',
        activeAreaId: '<',
        isUsCustomer: '<',
        // Callback bindings (expression)
        onAreaClick: '&',
        onCourierClick: '&',
        onClearFilter: '&',
    },
};

export default DriverLocationsReactComponent;
