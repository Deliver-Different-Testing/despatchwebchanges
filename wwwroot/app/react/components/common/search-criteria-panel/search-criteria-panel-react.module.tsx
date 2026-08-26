/**
 * SearchCriteriaPanel React Module
 *
 * AngularJS bridge for the React SearchCriteriaPanel component.
 * Replaces the entire pickDate.html template with a single React component
 * that manages date range, chip filters, text inputs, and action buttons.
 */

import React from 'react';
import {createRoot, Root} from 'react-dom/client';
import {SearchCriteriaPanel} from './SearchCriteriaPanel';
import angular from 'angular';
import {Dayjs} from 'dayjs';
import {ISuggestion} from '../../../../interfaces/job.interface';
import {islandTree} from '../../../theme/DfrntMantineProvider';

class SearchCriteriaPanelReactController implements angular.IController {
    static $inject = ['$element', '$scope'];

    private root: Root | null = null;

    // Bindings from AngularJS
    dateSearchRange?: string;
    fromDate?: Dayjs;
    toDate?: Dayjs;
    onSearchRangeChange?: (params: {range: string}) => void;
    onFromDateChange?: (params: {dateTime: Dayjs}) => void;
    onToDateChange?: (params: {dateTime: Dayjs}) => void;
    onCriteriaChange?: (params: {field: string; value: any}) => void;
    onSearch?: () => void;
    onDownload?: () => void;
    onClientReport?: () => void;
    onPriceDetailReport?: () => void;
    onUpload?: (params: {$event: React.MouseEvent}) => void;
    onClientSearch?: (params: {searchText: string}) => Promise<ISuggestion[]>;
    onCourierSearch?: (params: {searchText: string}) => Promise<ISuggestion[]>;
    onSpeedSearch?: (params: {searchText: string}) => Promise<ISuggestion[]>;

    constructor(private $element: JQLite, private $scope: angular.IScope) {}

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
        // Wrap AngularJS '&' callbacks to match React callback signatures.
        // Each callback calls $applyAsync() to trigger a digest cycle so
        // AngularJS detects the state change and re-renders via $onChanges.
        const handleSearchRangeChange = (range: string) => {
            this.onSearchRangeChange?.({range});
            this.$scope.$applyAsync();
        };

        const handleFromDateChange = (dateTime: Dayjs) => {
            this.onFromDateChange?.({dateTime});
            this.$scope.$applyAsync();
        };

        const handleToDateChange = (dateTime: Dayjs) => {
            this.onToDateChange?.({dateTime});
            this.$scope.$applyAsync();
        };

        const handleCriteriaChange = (field: string, value: any) => {
            this.onCriteriaChange?.({field, value});
            this.$scope.$applyAsync();
        };

        const handleSearch = () => {
            this.onSearch?.();
            this.$scope.$applyAsync();
        };

        const handleDownload = () => {
            this.onDownload?.();
            this.$scope.$applyAsync();
        };

        const handleClientReport = () => {
            this.onClientReport?.();
            this.$scope.$applyAsync();
        };

        const handlePriceDetailReport = () => {
            this.onPriceDetailReport?.();
            this.$scope.$applyAsync();
        };

        const handleUpload = (event: React.MouseEvent) => {
            this.onUpload?.({$event: event});
            this.$scope.$applyAsync();
        };

        // Search callbacks return Promises from AngularJS
        const handleClientSearch = (searchText: string) =>
            this.onClientSearch!({searchText});

        const handleCourierSearch = (searchText: string) =>
            this.onCourierSearch!({searchText});

        const handleSpeedSearch = (searchText: string) =>
            this.onSpeedSearch!({searchText});

        this.root.render(islandTree(
        <SearchCriteriaPanel
            dateSearchRange={this.dateSearchRange ?? 'fortnight'}
            fromDate={this.fromDate!}
            toDate={this.toDate!}
            onSearchRangeChange={handleSearchRangeChange}
            onFromDateChange={handleFromDateChange}
            onToDateChange={handleToDateChange}
            onCriteriaChange={handleCriteriaChange}
            onSearch={handleSearch}
            onDownload={handleDownload}
            onClientReport={handleClientReport}
            onPriceDetailReport={handlePriceDetailReport}
            onUpload={handleUpload}
            onClientSearch={handleClientSearch}
            onCourierSearch={handleCourierSearch}
            onSpeedSearch={handleSpeedSearch}
        />

        ));
    }
}

/**
 * AngularJS component definition for the React SearchCriteriaPanel
 */
export const SearchCriteriaPanelReactComponent: angular.IComponentOptions = {
    controller: SearchCriteriaPanelReactController,
    bindings: {
        dateSearchRange: '<',
        fromDate: '<',
        toDate: '<',
        onSearchRangeChange: '&',
        onFromDateChange: '&',
        onToDateChange: '&',
        onCriteriaChange: '&',
        onSearch: '&',
        onDownload: '&',
        onClientReport: '&',
        onPriceDetailReport: '&',
        onUpload: '&',
        onClientSearch: '&',
        onCourierSearch: '&',
        onSpeedSearch: '&',
    },
};

export default SearchCriteriaPanelReactComponent;
