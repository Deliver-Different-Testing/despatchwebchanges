import JobSearchComponent from "./jobSearch.controller";
import JobSearchService from "./jobSearch.service";
import AdditionalServicesDialogService from "../dialogs/additional-services-dialog/additional-services-dialog.service";
import DispatchExecutorService from "../../services/dispatch-executor.service";
import AdditionalServicesDialogController
    from "../dialogs/additional-services-dialog/additional-services-dialog.controller";
import DispatchMapComponent from "../common/dispatch-map/dispatch-map.component";
import JobContextMenuService from "../../services/job-context-menu.service";
import {TaskHistoryComponent} from "../common/task-history/task-history.component";
import JobsListComponent from "../common/job-list/job-list.component";
import JobHighlightService from "../common/job-list/job-highlight.service";
import CreateJobDialogService from "../dialogs/create-job-dialog/create-job-dialog.service";
import {CreateJobDialogController} from "../dialogs/create-job-dialog/create-job-dialog.controller";

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
    .component("taskHistory", TaskHistoryComponent)
    .component("jobsList", JobsListComponent);

jobSearchModule
    .controller("AdditionalServicesDialogController", AdditionalServicesDialogController)
    .controller("CreateJobDialogController", CreateJobDialogController);

// Services
jobSearchModule
    .service("uCSData", JobSearchService)
    .service("additionalServicesDialogService", AdditionalServicesDialogService)
    .service("dispatchJobService", DispatchExecutorService)
    .service("jobContextMenuService", JobContextMenuService)
    .service("jobHighlightService", JobHighlightService)
    .service("createJobDialogService", CreateJobDialogService);

export default jobSearchModule;