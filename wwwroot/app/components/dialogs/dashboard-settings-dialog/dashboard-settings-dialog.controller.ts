import "./dashboard-settings-dialog.less";
import {IBox} from "../../../interfaces/layout.interfaces";
import BaseController from "../../base-controller";
import {ISuggestion} from "../../../interfaces/job.interface";
import {getMinsSelectionOptions} from "../../../functions/MinsSelectionOptions";
import ISettingsDialogResult from "./interfaces/IDashboardSettingsDialogResult";
import IDashboardSettingsConfig from "./interfaces/IDashboardSettingsConfig";

class DashboardSettingsDialogController extends BaseController {
    static $inject = [
        '$mdDialog',
        'selectedRefreshInterval',
        'selectedDriverLocationRefreshInterval',
        'boxes',
        'config'
    ];

    refreshIntervalOptions: ISuggestion[];
    driverLocationRefreshIntervalOptions: ISuggestion[];
    boxes: Record<string, IBox>;
    selectedRefreshInterval: ISuggestion;
    selectedDriverLocationRefreshInterval: ISuggestion;
    config: IDashboardSettingsConfig;

    constructor(
        private $mdDialog: angular.material.IDialogService,
        selectedRefreshInterval: ISuggestion,
        selectedDriverLocationRefreshInterval: ISuggestion,
        boxes: Record<string, IBox>,
        config: IDashboardSettingsConfig,
    ) {
        super();
        this.refreshIntervalOptions = this.initRefreshIntervalOptions();
        this.driverLocationRefreshIntervalOptions = this.initRefreshIntervalOptions();
        this.selectedRefreshInterval = angular.copy(selectedRefreshInterval) ?? this.createDisabledOption();
        this.selectedDriverLocationRefreshInterval = angular.copy(selectedDriverLocationRefreshInterval) ?? this.createDisabledOption();
        this.boxes = angular.copy(boxes);
        this.config = angular.copy(config);
    }
    
    initRefreshIntervalOptions(): ISuggestion[] {
        return [
            this.createDisabledOption(),
            ...getMinsSelectionOptions()
        ];
    }

    private createDisabledOption(): ISuggestion {
        return {id: 0, text: "Disabled"};
    }

    onRefreshIntervalChange(interval: ISuggestion): void {
        this.selectedRefreshInterval = interval;
    }

    isAutoRefreshActive(): boolean {
        return this.selectedRefreshInterval &&
            this.selectedRefreshInterval.id !== 0;
    }

    getCurrentRefreshIntervalText(): string {
        if (!this.selectedRefreshInterval) {
            return 'Not set';
        }
        return this.isAutoRefreshActive()
            ? 'Auto-refresh active'
            : 'Manual refresh only';
    }

    onDriverLocationRefreshIntervalChange(interval: ISuggestion): void {
        this.selectedDriverLocationRefreshInterval = interval;
    }

    isDriverLocationAutoRefreshActive(): boolean {
        return this.selectedDriverLocationRefreshInterval &&
            this.selectedDriverLocationRefreshInterval.id !== 0;
    }

    getCurrentDriverLocationRefreshIntervalText(): string {
        if (!this.selectedDriverLocationRefreshInterval) {
            return 'Not set';
        }
        return this.isDriverLocationAutoRefreshActive()
            ? 'Auto-refresh active'
            : 'Manual refresh only';
    }

    toggleDashboard(box: IBox): void {
        box.visible = !box.visible;
    }

    cancel(): void {
        this.$mdDialog.cancel();
    }

    save(): void {
        const result: ISettingsDialogResult = {
            selectedRefreshInterval: this.selectedRefreshInterval,
            selectedDriverLocationRefreshInterval: this.selectedDriverLocationRefreshInterval,
            boxes: this.boxes
        };
        this.$mdDialog.hide(result);
    }
}

export default DashboardSettingsDialogController;