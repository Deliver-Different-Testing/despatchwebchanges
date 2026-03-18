import NationwideComponent from "./nationwide.controller";
import NationwideService from "./nationwide.service";
import FlightDetailsDialogService from "../dialogs/flight-details-dialog/flight-details-dialog.service";
import FlightAgentConfirmationDialogService
    from "../dialogs/flight-agent-conformation-dialog/flight-agent-confirmation-dialog.service";
import TasksService from "../../services/tasks.service";
import AccessorialChargesDialogService from "../dialogs/accessorial-charges-dialog/accessorial-charges-dialog.service";
import DispatchExecutorService from "../../services/dispatch-executor.service";
import {
    FeatureInDevelopmentDialogService
} from "../dialogs/feature-in-development-dialog/feature-in-development-dialog.service";
import JobContextMenuService from "../../services/job-context-menu.service";
import RecoveryAgentManagementController
    from "../dialogs/recovery-agent-management-dialog/recovery-agent-management-dialog.controller";
import RecoveryAgentManagementService
    from "../dialogs/recovery-agent-management-dialog/recovery-agent-management-dialog.service";
import DashboardSettingsDialogService from "../dialogs/dashboard-settings-dialog/dashboard-settings-dialog.service";
import angular from 'angular';

const nationwideModule = angular.module('uDispatch.nationwide', [
    'ui.router',
    'ngMaterial',
    'ngAnimate',
    'ngAria',
    'ngMessages',
    'md.data.table',
    'ui.sortable',
    'angularResizable'
]);

// Register components
nationwideModule
    .component("nationwideComponent", NationwideComponent);

// Register services
nationwideModule
    .service("NWData", NationwideService)
    .service("tasksService", TasksService)
    .service("flightDetailsDialogService", FlightDetailsDialogService)
    .service("flightAgentConfirmationDialogService", FlightAgentConfirmationDialogService)
    .service("accessorialChargesDialogService", AccessorialChargesDialogService)
    .service("dispatchJobService", DispatchExecutorService)
    .service("featureInDevelopmentDialogService", FeatureInDevelopmentDialogService)
    .service("jobContextMenuService", JobContextMenuService)
    .service("recoveryAgentManagementService", RecoveryAgentManagementService)
    .service("dashboardSettingsDialogService", DashboardSettingsDialogService);

// Register controllers
nationwideModule
    .controller("recoveryAgentManagementController", RecoveryAgentManagementController);

export default nationwideModule;