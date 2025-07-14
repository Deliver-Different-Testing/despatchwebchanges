import RecurringJobsComponent from "./recurringJobs.controller";
import RecurringJobsService from "./recurringJobs.service";
import JobContextMenuService from "../../services/job-context-menu.service";
import DispatchExecutorService from "../../services/dispatch-executor.service";

const recurringJobsModule = angular.module('uDispatch.recurringJobs', [
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
recurringJobsModule
    .component("recurringJobsComponent", RecurringJobsComponent);

// Services
recurringJobsModule
    .service("uPBData", RecurringJobsService)
    .service("jobContextMenuService", JobContextMenuService)
    .service("dispatchJobService", DispatchExecutorService);

export default recurringJobsModule;