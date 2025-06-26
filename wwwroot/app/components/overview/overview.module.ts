import OverviewComponent from "./overview.controller";
import {openJobsComponent} from "./open-jobs/open-jobs.controller";
import OverviewService from "./overview.service";
import OverviewFiltersService from "./services/overview-filters.service";
import {DateRangeDialogController} from "../dialogs/date-range-dialog/date-range-dialog.controller";
import {MapDialogController} from "../dialogs/map-dialog/map-dialog.controller";

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
    .component("openJobsWidget", openJobsComponent)
    .service("overviewService", OverviewService)
    .service("overviewFiltersService", OverviewFiltersService)
    .controller('DateRangeDialogController', DateRangeDialogController)
    .controller('MapDialogController', MapDialogController);

export default overviewModule;