import HomeComponent from "./home.controller";
import TasksService from "../../services/tasks.service";
import AccessorialChargesDialogService from "../dialogs/accessorial-charges-dialog/accessorial-charges-dialog.service";
import DispatchExecutorService from "../../services/dispatch-executor.service";
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
]);

// Register components
homeModule
    .component("homeComponent", HomeComponent)
    .component("currentWorkAllDriversReact", CurrentWorkAllDriversReactComponent);

// Register services
homeModule
    .service("tasksService", TasksService)
    .service("accessorialChargesDialogService", AccessorialChargesDialogService)
    .service("dispatchJobService", DispatchExecutorService)
    .service("createJobDialogService", CreateJobDialogService)
    .service("dashboardSettingsDialogService", DashboardSettingsDialogService);
export default homeModule;