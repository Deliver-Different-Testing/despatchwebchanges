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
    selectedRefreshInterval: ISuggestion;
    selectedDriverLocationRefreshInterval: ISuggestion;

    constructor(
        private $mdDialog: angular.material.IDialogService,
        selectedRefreshInterval: ISuggestion,
        selectedDriverLocationRefreshInterval: ISuggestion,
        public boxes: Record<string, IBox>,
        public config: IDashboardSettingsConfig,
    ) {
        super();
        this.refreshIntervalOptions = this.initRefreshIntervalOptions();
        this.driverLocationRefreshIntervalOptions = this.initRefreshIntervalOptions();
        this.selectedRefreshInterval = angular.copy(selectedRefreshInterval) ?? this.createDisabledOption();
        this.selectedDriverLocationRefreshInterval = angular.copy(selectedDriverLocationRefreshInterval) ?? this.createDisabledOption();
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

    onDriverLocationRefreshIntervalChange(interval: ISuggestion): void {
        this.selectedDriverLocationRefreshInterval = interval;
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