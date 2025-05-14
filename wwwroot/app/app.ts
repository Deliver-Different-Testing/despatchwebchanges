import {AppConfig} from "./interfaces/app-config.interface";
import {AppPages} from "./enums/app-pages.enum";
import {PodPhotoViewerComponent} from "./components/common/pod-photo-viewer/pod-photo-viewer.component";
import {MaterialSidenavComponent} from "./components/common/side-nav/side-nav.component";
import HomeComponent from "./components/home/home.controller";
import {AutoCompleteDialogController} from "./components/dialogs/auto-complete-dialog/auto-complete-dialog.controller";
import {CreateJobDialogController} from "./components/dialogs/create-job-dialog/create-job-dialog.controller";
import {DateRangeDialogController} from "./components/dialogs/date-range-dialog/date-range-dialog.controller";
import {
    EditParcelDimensionsDialogController
} from "./components/dialogs/edit-parcel-dimensions-dialog/edit-parcel-dimensions-dialog.controller";
import {
    FeatureInDevelopmentDialogController
} from "./components/dialogs/feature-in-development-dialog/feature-in-development-dialog.controller";
import {SendMessageDialogController} from "./components/dialogs/send-message-dialog/send-message-dialog.controller";
import {SelectDialogController} from "./components/dialogs/select-dialog/select-dialog.controller";
import {MapDialogController} from "./components/dialogs/map-dialog/map-dialog.controller";
import MegaMapComponent from "./components/overview/mega-map/mega-map.controller";
import {openJobsComponent} from "./components/overview/open-jobs/open-jobs.controller";
import OverviewFiltersService from "./components/overview/services/overview-filters.service";
import OverviewComponent from "./components/overview/overview.controller";
import OverviewService from "./components/overview/overview.service";
import {
    FeatureInDevelopmentDialogService
} from "./components/dialogs/feature-in-development-dialog/feature-in-development-dialog.service";
import ConfigService from "./services/config.service";
import DispatchCoreService from "./services/dispatch-core.service";
import DispatchExecutorService from "./services/dispatch-executor.service";
import UsStatesService from "./services/getUsStates.service";
import NavigationService from "./services/navigation.service";
import ToastrService from "./services/toastr.service";
import {SelectDialogService} from "./components/dialogs/select-dialog/select-dialog.service";
import {EventGroupDialogController} from "./components/dialogs/event-group-dialog/event-group-dialog.controller";
import {EventGroupDialogService} from "./components/dialogs/event-group-dialog/event-group-dialog.service";
import {
    EditDateTimeDialogController
} from "./components/dialogs/edit-date-time-dialog/edit-date-time-dialog.controller";
import {EditDateTimeDialogService} from "./components/dialogs/edit-date-time-dialog/edit-date-time-dialog.service";
import DispatchMapComponent from "./components/common/dispatch-map/dispatch-map.component";
import EditAddressDialogController from "./components/dialogs/edit-address-dialog/edit-address-dialog.controller";
import {EditAddressDialogService} from "./components/dialogs/edit-address-dialog/edit-address-dialog.service";
import NationwideService from "./components/Nationwide/nationwide.service";
import {TaskItemComponent} from "./components/common/task-item-component/task-item.component";
import PriceBreakdownDialogService from "./components/dialogs/price-breakdown-dialog/price-breakdown-dialog.service";
import TaskDashboardComponent from "./components/task-dashboard/task-dashboard.controller";
import AdditionalServicesDialogService
    from "./components/dialogs/additional-services-dialog/additional-services-dialog.service";
import AdditionalServicesDialogController
    from "./components/dialogs/additional-services-dialog/additional-services-dialog.controller";
import JobDetailComponent from "./components/common/job-details/job-details.component";
import NoDataComponent from "./components/common/no-data/no-data.component";
import JobFileUploadController from "./components/dialogs/job-file-upload-dialog/job-file-upload.controller";
import JobFileUploadDialogService from "./components/dialogs/job-file-upload-dialog/job-file-upload-dialog.service";
import NationwideComponent from "./components/Nationwide/nationwide.controller";
import moment from "moment";
import NoteManagementDialogService from "./components/dialogs/note-management-dialog/note-management.dialog.service";
import NoteManagementDialogController
    from "./components/dialogs/note-management-dialog/note-management-dialog.component";
import NoteService from "./services/notes.service";
import {
    mdAutocompleteEnterSelectDirective,
    ngRightClickDirective,
    rightClickDirective
} from "./directives";
import RouterConfig from "./routes";
import ThemeConfig from "./materialTheme";
import AddEventDialogController from "./components/dialogs/add-event-dialog/add-event-dialog.controller";
import AddEventDialogService from "./components/dialogs/add-event-dialog/add-event-dialog.service";
import InterCourierChargeDialogController
    from "./components/dialogs/inter-courier-charge-dialog/inter-courier-charge-dialog.controller";
import InterCourierChargeDialogService
    from "./components/dialogs/inter-courier-charge-dialog/inter-courier-charge-dialog.service";
import {
    bytesFilter, getByAttrFilter, jobStatusIconFilter,
    momentFormatFilter,
    replaceFilter, selectedToTopFilter, switchFilter, timezoneShortFilter, uniqueFilter, urlFixFilter, minutesToTimeFilter
} from "./filters";
import JobContextMenuService from "./services/job-context-menu.service";
import StickyNoteComponent from "./components/common/sticky-notes/sticky-notes.component";
import EditParcelDimensionsDialogService
    from "./components/dialogs/edit-parcel-dimensions-dialog/edit-parcel-dimensions-dialog.service";
import ParcelVisualizationComponent
    from "./components/dialogs/edit-parcel-dimensions-dialog/parcel-visuailzation/parcel-visualization.component";
import RecurringJobsComponent from "./components/recurringJobs/recurringJobs.controller";
import RecurringJobsService from "./components/recurringJobs/recurringJobs.service";
import JobSearchService from "./components/jobSearch/jobSearch.service";
import JobSearchComponent from "./components/jobSearch/jobSearch.controller";
import FlightDetailsDialogService from "./components/dialogs/flight-details-dialog/flight-details-dialog.service";
import FlightDetailsDialogController from "./components/dialogs/flight-details-dialog/flight-details-dialog.component";
import AutoCompleteDialogService from "./components/dialogs/auto-complete-dialog/auto-complete-dialog.service";
import JobAddStopService from "./services/job-add-stop.service";

const app = angular.module("uDispatch", [
    "ui.router",
    "angularResizable",
    "ui.sortable",
    "ui.bootstrap",
    "ui.bootstrap.pagination",
    "ui.bootstrap.contextMenu",
    "cfp.hotkeys",
    "ui.timepicker",
    "pickadate",
    "ngMap",
    "ngMapAutocomplete",
    "angularjs-dropdown-multiselect",
    "heremaps",
    "ngAnimate",
    "ngMessages",
    "ngSanitize",
    "ngMaterial",
    "ng-mfb",
    "md.data.table",
    "ngFileUpload",
    "hereMapTracking.services",
    "hereMapTracking.components",
    "fixed.table.header",
    "ngMaterialDatePicker",
]);

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

// Routes
app.config(["$urlRouterProvider", "$stateProvider",
    ($urlRouterProvider: angular.ui.IUrlRouterProvider,
     $stateProvider: angular.ui.IStateProvider) => {
        new RouterConfig($urlRouterProvider, $stateProvider);
    }
]);

// Theme
app.config(["$mdThemingProvider", "APP_CONFIG",
    (
        $mdThemingProvider: angular.material.IThemingProvider,
        APP_CONFIG: AppConfig
    ): void => {
        const themeConfig = new ThemeConfig($mdThemingProvider, APP_CONFIG);
        themeConfig.configure();
    }
]);

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
    .config(["$mdDateLocaleProvider", "APP_CONFIG", (
        $mdDateLocaleProvider: angular.material.IDateLocaleProvider,
        APP_CONFIG: AppConfig) => {
        if (!APP_CONFIG.US_Customer) {
            // Set locale to New Zealand English
            moment.locale("en-nz");

            $mdDateLocaleProvider.formatDate = (date: Date) => moment(date).format("DD/MM/YYYY");

            $mdDateLocaleProvider.parseDate = (dateString: string) => {
                const m = moment(dateString, "DD/MM/YYYY", true);
                return m.isValid() ? m.toDate() : new Date();
            };

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
        }
    }]);

// Filters
app.filter("unique", () => uniqueFilter);
app.filter("urlFix", () => urlFixFilter);
app.filter("getByAttr", () => getByAttrFilter);
app.filter("switch", () => switchFilter);
app.filter("selectedToTop", () => selectedToTopFilter);
app.filter("bytes", () => bytesFilter);
app.filter("jobStatusIcon", () => jobStatusIconFilter);
app.filter("replace", () => replaceFilter);
app.filter('momentFormat', () => momentFormatFilter);
app.filter('timezoneShort', () => timezoneShortFilter);
app.filter('minutesToTime', () => minutesToTimeFilter);

// Directives
app.directive('ngRightClick', ngRightClickDirective);
app.directive('mdAutocompleteEnterSelect', mdAutocompleteEnterSelectDirective);
app.directive("rightClick", rightClickDirective);

// Components
app.component("jobDetailWidget", JobDetailComponent);
app.component("materialSidenav", MaterialSidenavComponent);
app.component("podPhotoViewer", PodPhotoViewerComponent);
app.component("openJobsWidget", openJobsComponent);
app.component("dispatchMap", DispatchMapComponent);
app.component("taskItemComponent", TaskItemComponent);
app.component("homeComponent", HomeComponent);
app.component("overviewComponent", OverviewComponent);
app.component("megaMapComponent", MegaMapComponent);
app.component("taskDashboardComponent", TaskDashboardComponent);
app.component("noData", NoDataComponent);
app.component("parcelVisualization", ParcelVisualizationComponent);
app.component("nationwideComponent", NationwideComponent);
app.component("stickyNote", StickyNoteComponent);
app.component("recurringJobsComponent", RecurringJobsComponent);
app.component("jobSearchComponent", JobSearchComponent);

// Dialogs
app.controller("AddEventDialogController", AddEventDialogController);
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
app.controller("EditAddressDialogController", EditAddressDialogController);
app.controller("jobFileUploadController", JobFileUploadController);
app.controller("jobNoteEditorDialogController", NoteManagementDialogController);
app.controller("InterCourierChargeDialog", InterCourierChargeDialogController);
app.controller("flightDetailsDialogController", FlightDetailsDialogController);

// Services
app.service("configService", ConfigService);
app.service("DispatchData", DispatchCoreService);
app.service("dispatchJobService", DispatchExecutorService);
app.service("UsStatesService", UsStatesService);
app.service("navigationService", NavigationService);
app.service("toastrService", ToastrService);
app.service("featureInDevelopmentDialogService", FeatureInDevelopmentDialogService);
app.service("overviewFiltersService", OverviewFiltersService);
app.service("overviewService", OverviewService);
app.service("uPBData", RecurringJobsService);
app.service('selectDialogService', SelectDialogService);
app.service('eventGroupDialogService', EventGroupDialogService);
app.service("editDateTimeDialogService", EditDateTimeDialogService);
app.service("editAddressDialogService", EditAddressDialogService);
app.service("NWData", NationwideService);
app.service("priceBreakdownDialogService", PriceBreakdownDialogService);
app.service("additionalServicesDialogService", AdditionalServicesDialogService);
app.service("jobFileUploadDialogService", JobFileUploadDialogService);
app.service("noteManagementDialogService", NoteManagementDialogService);
app.service("noteService", NoteService);
app.service("addEventDialogService", AddEventDialogService);
app.service("interCourierChargeDialogService", InterCourierChargeDialogService);
app.service("jobContextMenuService", JobContextMenuService);
app.service("editParcelDimensionsDialogService", EditParcelDimensionsDialogService);
app.service("uCSData", JobSearchService);
app.service("flightDetailsDialogService", FlightDetailsDialogService);
app.service("autoCompleteDialogService", AutoCompleteDialogService);
app.service("jobAddStopService", JobAddStopService);

export default app;
