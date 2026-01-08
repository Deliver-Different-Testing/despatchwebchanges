import HomeComponent from "./home.controller";
import JobsListComponent from "../common/job-list/job-list.component";
import TasksService from "../../services/tasks.service";
import AdditionalServicesDialogService from "../dialogs/additional-services-dialog/additional-services-dialog.service";
import InterCourierChargeDialogService
    from "../dialogs/inter-courier-charge-dialog/inter-courier-charge-dialog.service";
import InterCourierChargeDialogController
    from "../dialogs/inter-courier-charge-dialog/inter-courier-charge-dialog.controller";
import DispatchExecutorService from "../../services/dispatch-executor.service";
import {
    FeatureInDevelopmentDialogService
} from "../dialogs/feature-in-development-dialog/feature-in-development-dialog.service";
import AdditionalServicesDialogController
    from "../dialogs/additional-services-dialog/additional-services-dialog.controller";
import DispatchMapComponent from "../common/dispatch-map/dispatch-map.component";
import JobContextMenuService from "../../services/job-context-menu.service";
import JobHighlightService from "../common/job-list/job-highlight.service";
import {CreateJobDialogController} from "../dialogs/create-job-dialog/create-job-dialog.controller";
import CreateJobDialogService from "../dialogs/create-job-dialog/create-job-dialog.service";
import DashboardSettingsDialogService from "../dialogs/dashboard-settings-dialog/dashboard-settings-dialog.service";

const homeModule = angular.module('uDispatch.home', [
    'ngMap',
    'heremaps',
    'ui.router',
    'ngMaterial',
    'ngAnimate',
    'ngAria',
    'ngMessages',
    'ngSanitize',
    'md.data.table',
    'ui.sortable',
    'ui.bootstrap.contextMenu',
    'cfp.hotkeys',
    'angularResizable',
    'ng-mfb',
    'ngFileUpload',
    'hereMapTracking.services',
    'hereMapTracking.components',
    'fixed.table.header',
    'ngMaterialDatePicker'
]);

// Register components
homeModule
    .component("homeComponent", HomeComponent)
    .component("jobsList", JobsListComponent)
    .component("dispatchMap", DispatchMapComponent);

// Register services
homeModule
    .service("tasksService", TasksService)
    .service("additionalServicesDialogService", AdditionalServicesDialogService)
    .service("interCourierChargeDialogService", InterCourierChargeDialogService)
    .service("dispatchJobService", DispatchExecutorService)
    .service("jobContextMenuService", JobContextMenuService)
    .service("jobHighlightService", JobHighlightService)
    .service("featureInDevelopmentDialogService", FeatureInDevelopmentDialogService)
    .service("createJobDialogService", CreateJobDialogService)
    .service("dashboardSettingsDialogService", DashboardSettingsDialogService);
homeModule
    .controller("InterCourierChargeDialog", InterCourierChargeDialogController)
    .controller("AdditionalServicesDialogController", AdditionalServicesDialogController)
    .controller("CreateJobDialogController", CreateJobDialogController);

export default homeModule;