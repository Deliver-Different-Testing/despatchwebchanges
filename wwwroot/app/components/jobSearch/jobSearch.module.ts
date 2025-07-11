import JobSearchComponent from "./jobSearch.controller";
import JobSearchService from "./jobSearch.service";
import AdditionalServicesDialogService from "../dialogs/additional-services-dialog/additional-services-dialog.service";
import DispatchExecutorService from "../../services/dispatch-executor.service";
import AdditionalServicesDialogController from "../dialogs/additional-services-dialog/additional-services-dialog.controller";
import DispatchMapComponent from "../common/dispatch-map/dispatch-map.component";
import JobContextMenuService from "../../services/job-context-menu.service";
import {TaskHistoryComponent} from "../common/task-history/task-history.component";

const jobSearchModule = angular.module('uDispatch.jobSearch', [
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

// Components
jobSearchModule
    .component("jobSearchComponent", JobSearchComponent)
    .component("dispatchMap", DispatchMapComponent)
    .component("taskHistory", TaskHistoryComponent);

jobSearchModule
    .controller("AdditionalServicesDialogController", AdditionalServicesDialogController);

// Services
jobSearchModule
    .service("uCSData", JobSearchService)
    .service("additionalServicesDialogService", AdditionalServicesDialogService)
    .service("dispatchJobService", DispatchExecutorService)
    .service("jobContextMenuService", JobContextMenuService);

export default jobSearchModule;