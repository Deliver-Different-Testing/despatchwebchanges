import RecurringJobsComponent from "./recurringJobs.controller";
import RecurringJobsService from "./recurringJobs.service";

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

recurringJobsModule
    .component("recurringJobsComponent", RecurringJobsComponent)
    .service("uPBData", RecurringJobsService);

export default recurringJobsModule;