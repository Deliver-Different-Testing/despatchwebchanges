import OverviewComponent from "./overview.controller";
import {openJobsComponent} from "./open-jobs/open-jobs.controller";
import OverviewService from "./overview.service";
import OverviewFiltersService from "./services/overview-filters.service";
import {DateRangeDialogController} from "../dialogs/date-range-dialog/date-range-dialog.controller";
import {MapDialogController} from "../dialogs/map-dialog/map-dialog.controller";
import MapDialogService from "../dialogs/map-dialog/map-dialog.service";

const overviewModule = angular.module('uDispatch.overview', [
    'ui.router',
    'ngMaterial',
    'ngAnimate',
    'ngAria',
    'ngMessages',
    'md.data.table',
    'ngMap',
    'heremaps'
]);

overviewModule
    .component("overviewComponent", OverviewComponent)
    .component("openJobsWidget", openJobsComponent);

overviewModule
    .controller('DateRangeDialogController', DateRangeDialogController)
    .controller('MapDialogController', MapDialogController);

overviewModule
    .service("mapDialogService", MapDialogService)
    .service("overviewService", OverviewService)
    .service("overviewFiltersService", OverviewFiltersService);

export default overviewModule;