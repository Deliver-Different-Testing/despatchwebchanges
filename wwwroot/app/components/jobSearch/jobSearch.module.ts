import JobSearchComponent from "./jobSearch.controller";
import JobSearchService from "./jobSearch.service";

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

jobSearchModule
    .component("jobSearchComponent", JobSearchComponent)
    .service("uCSData", JobSearchService);

export default jobSearchModule;