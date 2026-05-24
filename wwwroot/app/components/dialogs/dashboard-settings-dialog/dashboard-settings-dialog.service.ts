import {AppPage} from "../../../enums/app-pages.enum";
import {ISuggestion} from "../../../interfaces/job.interface";
import {IBox} from "../../../interfaces/layout.interfaces";
import IDashboardSettingsConfig from "./interfaces/IDashboardSettingsConfig";
import ISettingsDialogResult from "./interfaces/IDashboardSettingsDialogResult";
import isDefaultLayout from "../../../functions/isDefaultLayout";
import {isAiEnabled, isAiServerEnabled} from "../../../functions/aiSettings";
import angular from 'angular';

class DashboardSettingsDialogService implements angular.IServiceProvider {
    static $inject = [
        '$ocLazyLoad',
        '$http',
    ];

    constructor(
        private $ocLazyLoad: oc.ILazyLoad,
        private $http: angular.IHttpService,
    ) {
        console.log('DashboardSettingsDialogService: Service instantiated');
    }

    /**
     * Load the React dashboard settings dialog module on demand
     */
    private async loadReactDashboardSettingsDialog(): Promise<void> {
        // Check if already loaded
        if (window.ReactDashboardSettingsDialog) {
            return;
        }

        try {
            // Load the manifest to get hashed filenames
            const manifestResponse = await this.$http.get<Record<string, string>>('dist/manifest.json');
            const manifest = manifestResponse.data;

            const getAssetPath = (filename: string) => `dist/${manifest[filename] || filename}`;

            // Load vendor-react first (if not already loaded)
            if (!(window as any).React) {
                await this.$ocLazyLoad.load(getAssetPath('vendor-react.js'));
            }

            // Load the dashboard settings dialog React module
            await this.$ocLazyLoad.load({
                name: 'uDispatch.dashboardSettingsDialogReact',
                files: [getAssetPath('dashboardSettingsDialogReact.js')]
            });
        } catch (error) {
            console.error('[DashboardSettingsDialogService] Failed to load React dialog:', error);
            throw error;
        }
    }

    $get() {
        return this;
    }

    async openSettingsDialog(_$event: MouseEvent, appPage: AppPage, currentLayoutName: string,
                             boxes: Record<string, IBox>, selectedRefreshInterval?: ISuggestion,
                             selectedDriverLocationRefreshInterval?: ISuggestion): Promise<ISettingsDialogResult | undefined> {
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

        const isValidPage = appPage === AppPage.Dispatch
            || appPage === AppPage.Domestic
            || appPage === AppPage.JobSearch;
        const canShowDashboards = isValidPage && !isDefaultLayout(currentLayoutName);

        console.log('DashboardSettingsDialog: Opening with layout', currentLayoutName, 'isDefault:', isDefaultLayout(currentLayoutName), 'canShowDashboards:', canShowDashboards);

        const config: IDashboardSettingsConfig = {
            title,
            showRefreshInterval: appPage === AppPage.Dispatch || appPage === AppPage.Domestic,
            showDriverLocationRefresh: appPage === AppPage.Dispatch,
            showDashboards: canShowDashboards,
            showAiToggle: isAiServerEnabled()
        };

        if (!selectedRefreshInterval) {
            selectedRefreshInterval = {id: 0, text: "Disabled"};
        }

        if (!selectedDriverLocationRefreshInterval) {
            selectedDriverLocationRefreshInterval = {id: 0, text: "Disabled"};
        }

        // Load the React dialog module on demand
        await this.loadReactDashboardSettingsDialog();

        if (!window.ReactDashboardSettingsDialog) {
            throw new Error('React dashboard settings dialog not loaded');
        }

        try {
            // Open the React dialog
            const result = await window.ReactDashboardSettingsDialog.open(
                config,
                boxes,
                selectedRefreshInterval,
                selectedDriverLocationRefreshInterval,
                isAiEnabled()
            );

            console.debug('DashboardSettingsDialogService: Dialog closed!');

            return result ?? undefined;
        } catch (error) {
            if (!error) {
                console.debug('User closed dialog');
                return;
            }

            console.error('DashboardSettingsDialogService: Error in openSettingsDialog', error);
            throw error;
        }
    }
}

export default DashboardSettingsDialogService;