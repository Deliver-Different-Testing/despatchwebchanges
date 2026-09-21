import {AppPage} from "../../../enums/app-pages.enum";
import {ISuggestion} from "../../../interfaces/job.interface";
import {IBox} from "../../../interfaces/layout.interfaces";
import IDashboardSettingsConfig from "./interfaces/IDashboardSettingsConfig";
import ISettingsDialogResult from "./interfaces/IDashboardSettingsDialogResult";
import isDefaultLayout from "../../../functions/isDefaultLayout";
import {getNationwideBetaEnabled} from "../../../react/pages/nationwide/lib/betaPreference";
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

            // The island's stylesheet has to be listed alongside its script: an emitted
            // CSS module is only fetched if it appears here, and a missing one fails
            // silently — the dialog just renders unstyled. Mirrors routes.ts's
            // `islandFiles`.
            const islandFiles = (entry: string) => {
                const files = [getAssetPath(`${entry}.js`)];
                if (manifest[`${entry}.css`]) {
                    files.push(getAssetPath(`${entry}.css`));
                }
                return files;
            };

            // Load vendor-react first (if not already loaded)
            if (!(window as any).React) {
                await this.$ocLazyLoad.load(getAssetPath('vendor-react.js'));
            }

            // Load the dashboard settings dialog React module
            await this.$ocLazyLoad.load({
                name: 'uDispatch.dashboardSettingsDialogReact',
                files: islandFiles('dashboardSettingsDialogReact')
            });
        } catch (error) {
            console.error('[DashboardSettingsDialogService] Failed to load React dialog:', error);
            throw error;
        }
    }

    $get() {
        return this;
    }

    async openSettingsDialog(_$event: MouseEvent, appPage: AppPage,
                             selectedRefreshInterval?: ISuggestion,
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

        // Panel visibility is not here: it lives in its own Customize Panels
        // dialog, reached from the Layouts menu.
        const config: IDashboardSettingsConfig = {
            title,
            showRefreshInterval: appPage === AppPage.Dispatch || appPage === AppPage.Domestic,
            showDriverLocationRefresh: appPage === AppPage.Dispatch,
            showNationwideBetaToggle: appPage === AppPage.Domestic,
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
                selectedRefreshInterval,
                selectedDriverLocationRefreshInterval,
                undefined, // selectedTaskRefreshInterval — V1 dispatch has no separate Tasks cadence
                appPage === AppPage.Domestic ? getNationwideBetaEnabled() : undefined,
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

    /**
     * Opens the dedicated Customize Panels dialog (panel visibility). Reachable
     * from the Layouts menu. Ships in the same bundle as the settings dialog.
     */
    async openCustomizePanelsDialog(
        currentLayoutName: string,
        boxes: Record<string, IBox>,
    ): Promise<Record<string, IBox> | undefined> {
        await this.loadReactDashboardSettingsDialog();

        if (!window.ReactCustomizePanelsDialog) {
            throw new Error('React customize panels dialog not loaded');
        }

        try {
            const result = await window.ReactCustomizePanelsDialog.open(
                boxes,
                currentLayoutName,
                !isDefaultLayout(currentLayoutName),
            );
            return result ?? undefined;
        } catch (error) {
            if (!error) {
                console.debug('User closed customize panels dialog');
                return;
            }
            console.error('DashboardSettingsDialogService: Error in openCustomizePanelsDialog', error);
            throw error;
        }
    }
}

export default DashboardSettingsDialogService;