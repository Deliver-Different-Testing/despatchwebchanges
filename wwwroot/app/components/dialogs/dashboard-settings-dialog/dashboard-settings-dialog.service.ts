import {AppPage} from "../../../enums/app-pages.enum";
import {ISuggestion} from "../../../interfaces/job.interface";
import {IBox} from "../../../interfaces/layout.interfaces";
import IDashboardSettingsConfig from "./interfaces/IDashboardSettingsConfig";
import DashboardSettingsDialogController from "./dashboard-settings-dialog.controller";
import ISettingsDialogResult from "./interfaces/IDashboardSettingsDialogResult";
import {IAppConfig} from "../../../interfaces/app-config.interface";
import isDefaultLayout from "../../../functions/isDefaultLayout";

class DashboardSettingsDialogService implements angular.IServiceProvider {
    static $inject = [
        "$mdDialog",
        "$document",
        'APP_CONFIG',
    ];

    constructor(
        private $mdDialog: angular.material.IDialogService,
        private $document: angular.IDocumentService,
        private appConfig: IAppConfig,
    ) {
        console.log('DashboardSettingsDialogService: Service instantiated');
    }

    $get() {
        return this;
    }

    async openSettingsDialog($event: MouseEvent, appPage: AppPage, currentLayoutName: string,
                             boxes: Record<string, IBox>, selectedRefreshInterval?: ISuggestion,
                             selectedDriverLocationRefreshInterval?: ISuggestion): Promise<ISettingsDialogResult | undefined> {
        try {
            let title: string;
            switch (appPage) {
                case AppPage.Dispatch:
                    title = "Dispatch Dashboard Settings";
                    break;
                case AppPage.Domestic:
                    title = "Domestic Dashboard Settings";
                    break;
                case AppPage.JobSearch:
                    title = "Job Search Dashboard Settings";
                    break;
                default:
                    title = "Dashboard Settings";
            }

            const isValidPage = appPage === AppPage.Dispatch || appPage === AppPage.Domestic || appPage === AppPage.JobSearch;
            const canShowDashboards = !this.appConfig.US_Customer && isValidPage && !isDefaultLayout(currentLayoutName);

            console.log('DashboardSettingsDialog: Opening with layout', currentLayoutName, 'isDefault:', isDefaultLayout(currentLayoutName), 'canShowDashboards:', canShowDashboards);

            const config: IDashboardSettingsConfig = {
                title,
                showRefreshInterval: appPage === AppPage.Dispatch || appPage === AppPage.Domestic,
                showDriverLocationRefresh: appPage === AppPage.Dispatch,
                showDashboards: canShowDashboards
            };

            if (selectedRefreshInterval) {
                selectedRefreshInterval = {id: 0, text: "Disabled"};
            }

            if (selectedDriverLocationRefreshInterval) {
                selectedDriverLocationRefreshInterval = {id: 0, text: "Disabled"};
            }

            return await this.$mdDialog.show({
                controller: DashboardSettingsDialogController,
                controllerAs: 'ctrl',
                targetEvent: $event,
                template: require("./dashboard-settings-dialog.template.html"),
                parent: this.$document.parent(),
                clickOutsideToClose: false,
                escapeToClose: true,
                locals: {
                    selectedRefreshInterval,
                    selectedDriverLocationRefreshInterval,
                    boxes,
                    config
                },
                bindToController: true,
                fullscreen: true,
            });
        } catch (error) {
            if (!error) return;
            console.error('DashboardSettingsDialogService: Error in openSettingsDialog', error);
            throw error;
        }
    }
}

export default DashboardSettingsDialogService;