import OverviewComponent from "./overview.controller";
import {openJobsComponent} from "./open-jobs/open-jobs.controller";
import OverviewService from "./overview.service";
import OverviewFiltersService from "./services/overview-filters.service";
import {MapDialogController} from "../dialogs/map-dialog/map-dialog.controller";
import MapDialogService from "../dialogs/map-dialog/map-dialog.service";
import angular from 'angular';

const overviewModule = angular.module('uDispatch.overview', [
    'ui.router',
    'ngMaterial',
    'ngAnimate',
    'ngAria',
    'ngMessages',
    'md.data.table'
]);

overviewModule
    .component("overviewComponent", OverviewComponent)
    .component("openJobsWidget", openJobsComponent);

overviewModule
    .controller('MapDialogController', MapDialogController);

overviewModule
    .service("mapDialogService", MapDialogService)
    .service("overviewService", OverviewService)
    .service("overviewFiltersService", OverviewFiltersService);

export default overviewModule;