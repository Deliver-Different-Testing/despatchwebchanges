import NationwideComponent from "./nationwide.controller";
import NationwideService from "./nationwide.service";
import FlightDetailsDialogService from "../dialogs/flight-details-dialog/flight-details-dialog.service";
import FlightAgentConfirmationDialogService
    from "../dialogs/flight-agent-conformation-dialog/flight-agent-confirmation-dialog.service";
import FlightDetailsDialogController from "../dialogs/flight-details-dialog/flight-details-dialog.component";
import AgentInfoDialogController from "../dialogs/agent-info-dialog/agent-info-dialog.controller";
import AgentInfoDialogService from "../dialogs/agent-info-dialog/agent-info-dialog.service";
import FlightAgentConformationDialogController
    from "../dialogs/flight-agent-conformation-dialog/flight-agent-conformation-dialog.controller";
import JobsListComponent from "../common/job-list/job-list.component";
import TasksService from "../../services/tasks.service";
import AdditionalServicesDialogService from "../dialogs/additional-services-dialog/additional-services-dialog.service";
import DispatchExecutorService from "../../services/dispatch-executor.service";
import {
    FeatureInDevelopmentDialogService
} from "../dialogs/feature-in-development-dialog/feature-in-development-dialog.service";
import AdditionalServicesDialogController
    from "../dialogs/additional-services-dialog/additional-services-dialog.controller";
import JobContextMenuService from "../../services/job-context-menu.service";
import JobHighlightService from "../common/job-list/job-highlight.service";
import RecoveryAgentManagementController
    from "../dialogs/recovery-agent-management-dialog/recovery-agent-management-dialog.controller";
import RecoveryAgentManagementService
    from "../dialogs/recovery-agent-management-dialog/recovery-agent-management-dialog.service";
import DashboardSettingsDialogService from "../dialogs/dashboard-settings-dialog/dashboard-settings-dialog.service";
import DashboardSettingsDialogController
    from "../dialogs/dashboard-settings-dialog/dashboard-settings-dialog.controller";

const nationwideModule = angular.module('uDispatch.nationwide', [
    'ngMap',
    'heremaps',
    'ui.router',
    'ngMaterial',
    'ngAnimate',
    'ngAria',
    'ngMessages',
    'md.data.table',
    'ui.sortable',
    'angularResizable',
    'ui.bootstrap.contextMenu'
]);

// Register components
nationwideModule
    .component("nationwideComponent", NationwideComponent)
    .component("jobsList", JobsListComponent);

// Register services
nationwideModule
    .service("NWData", NationwideService)
    .service("tasksService", TasksService)
    .service("flightDetailsDialogService", FlightDetailsDialogService)
    .service("flightAgentConfirmationDialogService", FlightAgentConfirmationDialogService)
    .service("agentInfoDialogService", AgentInfoDialogService)
    .service("additionalServicesDialogService", AdditionalServicesDialogService)
    .service("dispatchJobService", DispatchExecutorService)
    .service("featureInDevelopmentDialogService", FeatureInDevelopmentDialogService)
    .service("jobContextMenuService", JobContextMenuService)
    .service("jobHighlightService", JobHighlightService)
    .service("recoveryAgentManagementService", RecoveryAgentManagementService)
    .service("dashboardSettingsDialogService", DashboardSettingsDialogService);

// Register controllers
nationwideModule
    .controller("flightDetailsDialogController", FlightDetailsDialogController)
    .controller("flightAgentConformationDialogController", FlightAgentConformationDialogController)
    .controller("agentInfoDialogController", AgentInfoDialogController)
    .controller("AdditionalServicesDialogController", AdditionalServicesDialogController)
    .controller("recoveryAgentManagementController", RecoveryAgentManagementController)
    .controller("DashboardSettingsDialogController", DashboardSettingsDialogController);

export default nationwideModule;