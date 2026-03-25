import HomeComponent from "./home.controller";
import TasksService from "../../services/tasks.service";
import AccessorialChargesDialogService from "../dialogs/accessorial-charges-dialog/accessorial-charges-dialog.service";
import InterCourierChargeDialogService
    from "../dialogs/inter-courier-charge-dialog/inter-courier-charge-dialog.service";
import InterCourierChargeDialogController
    from "../dialogs/inter-courier-charge-dialog/inter-courier-charge-dialog.controller";
import DispatchExecutorService from "../../services/dispatch-executor.service";
import {
    FeatureInDevelopmentDialogService
} from "../dialogs/feature-in-development-dialog/feature-in-development-dialog.service";
import { CurrentWorkAllDriversReactComponent } from "../../react/components/common/current-work-all-drivers";
import CreateJobDialogService from "../dialogs/create-job-dialog/create-job-dialog.service";
import DashboardSettingsDialogService from "../dialogs/dashboard-settings-dialog/dashboard-settings-dialog.service";
import angular from 'angular';

const homeModule = angular.module('uDispatch.home', [
    'ui.router',
    'ngMaterial',
    'ngAnimate',
    'ngAria',
    'ngMessages',
    'ngSanitize',
    'md.data.table',
    'ui.sortable',
    'angularResizable',
    'ngFileUpload'
]);

// Register components
homeModule
    .component("homeComponent", HomeComponent)
    .component("currentWorkAllDriversReact", CurrentWorkAllDriversReactComponent);

// Register services
homeModule
    .service("tasksService", TasksService)
    .service("accessorialChargesDialogService", AccessorialChargesDialogService)
    .service("interCourierChargeDialogService", InterCourierChargeDialogService)
    .service("dispatchJobService", DispatchExecutorService)
    .service("featureInDevelopmentDialogService", FeatureInDevelopmentDialogService)
    .service("createJobDialogService", CreateJobDialogService)
    .service("dashboardSettingsDialogService", DashboardSettingsDialogService);
homeModule
    .controller("InterCourierChargeDialog", InterCourierChargeDialogController);

export default homeModule;