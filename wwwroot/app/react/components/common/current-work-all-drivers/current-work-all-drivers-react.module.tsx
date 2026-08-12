/**
 * Current Work All Drivers React Module
 *
 * Entry point for the React-based CurrentWorkAllDrivers component.
 * Provides AngularJS integration via react2angular pattern.
 */

import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { CurrentWorkAllDrivers } from './CurrentWorkAllDrivers';
import type { IDriverWorkOverview } from './CurrentWorkAllDrivers.types';
import {islandTree} from '../../../theme/DfrntMantineProvider';
import angular from 'angular';

/**
 * AngularJS Component Controller for React CurrentWorkAllDrivers
 */
class CurrentWorkAllDriversReactController implements angular.IController {
    static $inject = ['$element'];

    private root: Root | null = null;

    // Data bindings from AngularJS
    drivers?: IDriverWorkOverview[];
    loading?: boolean;
    selectedCourierId?: number;

    // Callback bindings from AngularJS (& binding)
    onDriverSelect?: (params: { driver: IDriverWorkOverview }) => void;

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

        // Wrap AngularJS callback to match React expected signature
        const handleDriverSelect = this.onDriverSelect
            ? (driver: IDriverWorkOverview) => this.onDriverSelect!({ driver })
            : () => {};

        this.root.render(islandTree(
            <CurrentWorkAllDrivers
                drivers={this.drivers || []}
                loading={this.loading}
                selectedCourierId={this.selectedCourierId}
                onDriverSelect={handleDriverSelect}
            />
        ));
    }
}

/**
 * AngularJS Component Definition
 */
const CurrentWorkAllDriversReactComponent: angular.IComponentOptions = {
    controller: CurrentWorkAllDriversReactController,
    bindings: {
        drivers: '<',
        loading: '<',
        selectedCourierId: '<',
        onDriverSelect: '&',
    },
};

export default CurrentWorkAllDriversReactComponent;
