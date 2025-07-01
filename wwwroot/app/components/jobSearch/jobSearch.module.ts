import JobSearchComponent from "./jobSearch.controller";
import JobSearchService from "./jobSearch.service";
import AdditionalServicesDialogService from "../dialogs/additional-services-dialog/additional-services-dialog.service";
import DispatchExecutorService from "../../services/dispatch-executor.service";

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

// Services
jobSearchModule
    .service("uCSData", JobSearchService)
    .service("additionalServicesDialogService", AdditionalServicesDialogService)
    .service("dispatchJobService", DispatchExecutorService);

export default jobSearchModule;