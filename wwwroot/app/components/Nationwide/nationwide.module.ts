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

nationwideModule
    .component("nationwideComponent", NationwideComponent)
    .service("NWData", NationwideService)
    .controller("flightDetailsDialogController", FlightDetailsDialogController)
    .service("flightDetailsDialogService", FlightDetailsDialogService)
    .controller("flightAgentConformationDialogController", FlightAgentConformationDialogController)
    .service("flightAgentConfirmationDialogService", FlightAgentConfirmationDialogService)
    .controller("agentInfoDialogController", AgentInfoDialogController)
    .service("agentInfoDialogService", AgentInfoDialogService)
    .service("flightDetailsDialogService", FlightDetailsDialogService)
    .service("agentInfoDialogService", AgentInfoDialogService)
    .controller("agentInfoDialogController", AgentInfoDialogController)
    .controller("flightAgentConformationDialogController", FlightAgentConformationDialogController)
    .controller("flightDetailsDialogController", FlightDetailsDialogController);

export default nationwideModule;