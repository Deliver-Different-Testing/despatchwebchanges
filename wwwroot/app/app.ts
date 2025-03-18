import {AppConfig} from "./interfaces/app-config.interface";
import {AppPages} from "./enums/app-pages.enum";
import {DfrntLoaderComponent} from "./components/common/dfrnt-loader/dfrnt-loader.component";
import {ContextMenuDirective} from "./components/common/job-context-menu/job-context-menu.controller";
import {JobDetailComponent} from "./components/common/job-details/job-details.component";
import {PodPhotoViewerComponent} from "./components/common/pod-photo-viewer/pod-photo-viewer.component";
import {MaterialSidenavComponent} from "./components/common/side-nav/side-nav.component";
import {HomeController} from "./components/home/home.controller";
import {AddNotesDialogController} from "./components/dialogs/add-notes-dialog/add-notes-dialog.controller";
import {AddEventDialogController} from "./components/dialogs/add-event-dialog/add-event-dialog.controller";
import {PalletDialogController} from "./components/dialogs/add-pallet-dialog/add-pallet-dialog.controller";
import {
    AdditionalServicesDialogController
} from "./components/dialogs/additional-services-dialog/additional-services-dialog.controller";
import {AutoCompleteDialogController} from "./components/dialogs/auto-complete-dialog/auto-complete-dialog.controller";
import {CreateJobDialogController} from "./components/dialogs/create-job-dialog/create-job-dialog.controller";
import {DateRangeDialogController} from "./components/dialogs/date-range-dialog/date-range-dialog.controller";
import {
    EditParcelDimensionsDialogController
} from "./components/dialogs/edit-parcel-dimensions-dialog/edit-parcel-dimensions-dialog.controller";
import {
    ParcelVisualizationDirective
} from "./components/dialogs/edit-parcel-dimensions-dialog/parcel-visualization.directive";
import {
    FeatureInDevelopmentDialogController
} from "./components/dialogs/feature-in-development-dialog/feature-in-development-dialog.controller";
import {SendMessageDialogController} from "./components/dialogs/send-message-dialog/send-message-dialog.controller";
import {SelectDialogController} from "./components/dialogs/select-dialog/select-dialog.controller";
import {MapDialogController} from "./components/dialogs/map-dialog/map-dialog.controller";
import {NationwideLayoutService} from "./components/Nationwide/services/nationwide-layout.service";
import {MegaMapController} from "./components/overview/mega-map/mega-map.controller";
import {openJobsComponent} from "./components/overview/open-jobs/open-jobs.controller";
import OverviewFiltersService from "./components/overview/services/overview-filters.service";
import {OverviewController} from "./components/overview/overview.controller";
import OverviewService from "./components/overview/overview.service";
import PrebookService from "./components/prebooks/prebook.service";
import {
    FeatureInDevelopmentDialogService
} from "./components/dialogs/feature-in-development-dialog/feature-in-development-dialog.service";
import {TaskDashboardController} from "./components/task-dashboard/task-dashboard.controller";
import TasksDashboardService from "./components/task-dashboard/tasks-dashboard.service";
import ConfigService from "./services/config.service";
import DispatchCoreService from "./services/dispatch-core.service";
import DispatchExecutorService from "./services/dispatch-executor.service";
import UsStatesService from "./services/getUsStates.service";
import GreetingService from "./services/greeting.service";
import OpenJobDispatchService from "./services/open-job-dispatch.service";
import RateJobService from "./services/rate-job.service";
import ToastrService from "./services/ToastrService";
import {SelectDialogService} from "./components/dialogs/select-dialog/select-dialog.service";
import {EventGroupDialogController} from "./components/dialogs/event-group-dialog/event-group-dialog.controller";
import {EventGroupDialogService} from "./components/dialogs/event-group-dialog/event-group-dialog.service";
import {
    EditDateTimeDialogController
} from "./components/dialogs/edit-date-time-dialog/edit-date-time-dialog.controller";
import {EditDateTimeDialogService} from "./components/dialogs/edit-date-time-dialog/edit-date-time-dialog.service";
import DispatchMapComponent from "./components/common/dispatch-map/dispatch-map.directive";

const app = angular.module("uDispatch", ["ui.router", "ct.ui.router.extras",
    "angularResizable", "ui.sortable", "ui.bootstrap", "ui.bootstrap.pagination",
    "ui.bootstrap.contextMenu", "cfp.hotkeys", "ui.timepicker", "pickadate", "ngMap",
    "ngMapAutocomplete", "angularjs-dropdown-multiselect", "heremaps", "ngAnimate",
    "ngMessages", "ngSanitize", "ngMaterial", "angularPromiseButtons", "ng-mfb",
    "md.time.picker", "angularMoment", "md.data.table", "ngFileUpload", "hereMapTracking.services", "hereMapTracking.components"]);

// Constants
app
    .constant("APP_CONFIG", {
        US_Customer: (serverConfig as any).isUSCustomer,
        US_Coordinates_Center: {
            lat: 39.8283,
            lng: -98.5795
        },
        NZ_Coordinates_Center: {
            lat: -36.8485,
            lng: 174.7633
        }
    } as AppConfig)
    .constant("AppPages", AppPages);

// Directives
app
    .directive("rightClick", ["$document", ($document: angular.IDocumentService) => {
        $document.on('contextmenu', (event: JQueryEventObject) => {
            const target = event.target as HTMLElement;
            if (target.hasAttribute("right-click")) {
                event.preventDefault();
                event.stopPropagation();
                return false;
            }
        });

        return (scope: angular.IScope, el: JQLite, attrs: any) => {
            el.bind("contextmenu", (e: JQueryEventObject) => {
                e.preventDefault();
                scope.$apply(() => {
                    scope.$eval(attrs.rightClick, {
                        'event': e
                    });
                });
            });
        };
    }]);

// Configs
app
    .config(["HereMapsConfigProvider", (HereMapsConfigProvider: any) => {
        HereMapsConfigProvider.setOptions({
            'app_id': "bBPfh2x8Cauun3ygLMAx",
            'app_code': "yjfwTdkin_R2rGXYTrwWVg",
            'useHTTPS': true,
            'useCIT': true,
            'mapTileConfig': {
                metadataQueryParams: {
                    'lg2': "ara"
                }
            }
        });
    }])
    .config(["$qProvider", ($qProvider: angular.IQProvider) => {
        $qProvider.errorOnUnhandledRejections(false);
    }])
    .config(["$mdDateLocaleProvider", "moment", "APP_CONFIG", ($mdDateLocaleProvider: any, moment: any, APP_CONFIG: any) => {
        if (!APP_CONFIG.US_Customer) {
            // Set locale to New Zealand English
            moment.locale("en-nz");

            $mdDateLocaleProvider.formatDate = (date: Date) => moment(date).format("DD/MM/YYYY");

            $mdDateLocaleProvider.parseDate = (dateString: string) => {
                const m = moment(dateString, "DD/MM/YYYY", true);
                return m.isValid() ? m.toDate() : null;
            };

            $mdDateLocaleProvider.isDateComplete = (dateString: string) => moment(dateString, "DD/MM/YYYY", true).isValid();

            // First day of the week is Monday (1) in New Zealand
            $mdDateLocaleProvider.firstDayOfWeek = 1;

            // Define month names
            $mdDateLocaleProvider.months = moment.months();

            // Define day names (start with Monday)
            $mdDateLocaleProvider.days = moment.weekdays(true);

            // Define short day names (start with Monday)
            $mdDateLocaleProvider.shortDays = moment.weekdaysShort(true);

            // Month header formatter
            $mdDateLocaleProvider.monthHeaderFormatter = (date: Date) => moment(date).format("MMMM YYYY");

            // Week number formatter
            $mdDateLocaleProvider.weekNumberFormatter = (weekNumber: number) => `Week ${weekNumber}`;

            $mdDateLocaleProvider.msgCalendar = "Calendar";
            $mdDateLocaleProvider.msgOpenCalendar = "Open calendar";

            // Date-picker specific display and parsing
            $mdDateLocaleProvider.dateFormat = "dd/MM/yyyy";
            $mdDateLocaleProvider.inputDateFormat = "dd/MM/yyyy";

            // Long date format (e.g., "14 July 2023")
            $mdDateLocaleProvider.longDateFormat = (date: Date) => moment(date).format("D MMMM YYYY");

            // Short time format
            $mdDateLocaleProvider.timeFormat = "h:mm a";
        }
    }]);

// Components
app.component('dfrntLoader', DfrntLoaderComponent);
app.component("jobDetailWidget", JobDetailComponent);
app.component("materialSidenav", MaterialSidenavComponent);
app.component("podPhotoViewer", PodPhotoViewerComponent);
app.component("openJobsWidget", openJobsComponent)
app.component("dispatchMap", DispatchMapComponent)

// Dialogs
app.controller("AddEventDialogController", AddEventDialogController);
app.controller("AddNotesDialogController", AddNotesDialogController);
app.controller("PalletDialogController", PalletDialogController);
app.controller("AdditionalServicesDialogController", AdditionalServicesDialogController);
app.controller("AutoCompleteDialogController", AutoCompleteDialogController);
app.controller("CreateJobDialogController", CreateJobDialogController);
app.controller("DateRangeDialogController", DateRangeDialogController);
app.controller("EditParcelDimensionsDialogController", EditParcelDimensionsDialogController);
app.controller("FeatureInDevelopmentDialogController", FeatureInDevelopmentDialogController);
app.controller("SendMessageDialogController", SendMessageDialogController);
app.controller("SelectDialogController", SelectDialogController);
app.controller("MapDialogController", MapDialogController);
app.controller('EventGroupDialogController', EventGroupDialogController);
app.controller("EditDateTimeDialogController", EditDateTimeDialogController);

// Directives
app.directive("contextMenu", ContextMenuDirective.factory());
app.directive("parcelVisualization", ParcelVisualizationDirective.factory());

// Controllers
app.controller('HomeControl', HomeController);
app.controller("megaMapController", MegaMapController);
app.controller("deliveryOverview", OverviewController);
app.controller("taskDashboardController", TaskDashboardController);

// Services
app.service("configService", ConfigService);
app.service("DispatchData", DispatchCoreService);
app.service("dispatchJobService", DispatchExecutorService);
app.service("UsStatesService", UsStatesService);
app.service("greetingService", GreetingService);
app.service("openJobDispatchService", OpenJobDispatchService);
app.service("rateJobService", RateJobService);
app.service("toastrService", ToastrService);
app.service("featureInDevelopmentDialogService", FeatureInDevelopmentDialogService);
app.service("NationwideLayoutService", NationwideLayoutService);
app.service("overviewFiltersService", OverviewFiltersService);
app.service("overviewService", OverviewService);
app.service("uPBData", PrebookService);
app.service("tasksDashboardsService", TasksDashboardService);
app.service('selectDialogService', SelectDialogService);
app.service('eventGroupDialogService', EventGroupDialogService);
app.service("editDateTimeDialogService", EditDateTimeDialogService);

export default app;
