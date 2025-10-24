import {AppPages} from "../../../enums/app-pages.enum";
import {ISuggestion} from "../../../interfaces/job.interface";
import {IBox} from "../../../interfaces/layout.interfaces";
import IDashboardSettingsConfig from "./interfaces/IDashboardSettingsConfig";
import DashboardSettingsDialogController from "./dashboard-settings-dialog.controller";
import ISettingsDialogResult from "./interfaces/IDashboardSettingsDialogResult";

class DashboardSettingsDialogService implements angular.IServiceProvider {
    static $inject = [
        "$mdDialog",
        "$document"
    ];

    constructor(
        private $mdDialog: angular.material.IDialogService,
        private $document: angular.IDocumentService,
    ) {
        console.log('DashboardSettingsDialogService: Service instantiated');
    }

    $get() {
        return this;
    }

    async openSettingsDialog($event: MouseEvent, appPage: AppPages, currentLayoutName: string,
                             boxes: Record<string, IBox>, selectedRefreshInterval?: ISuggestion): Promise<ISettingsDialogResult | undefined> {
        try {
            const config: IDashboardSettingsConfig = {
                showRefreshInterval: appPage === AppPages.Dispatch,
                showDashboards: (appPage === AppPages.Dispatch || appPage === AppPages.Domestic)
                    && currentLayoutName !== "Default",
            };

            if (selectedRefreshInterval) {
                selectedRefreshInterval = {id: 0, text: "Disabled"};
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