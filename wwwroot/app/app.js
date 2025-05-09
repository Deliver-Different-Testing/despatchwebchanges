"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_pages_enum_1 = require("./enums/app-pages.enum");
const dfrnt_loader_component_1 = require("./components/common/dfrnt-loader/dfrnt-loader.component");
const job_context_menu_controller_1 = require("./components/common/job-context-menu/job-context-menu.controller");
const job_details_component_1 = require("./components/common/job-details/job-details.component");
const pod_photo_viewer_component_1 = require("./components/common/pod-photo-viewer/pod-photo-viewer.component");
const side_nav_component_1 = require("./components/common/side-nav/side-nav.component");
const home_controller_1 = require("./components/home/home.controller");
const add_notes_dialog_controller_1 = require("./components/dialogs/add-notes-dialog/add-notes-dialog.controller");
const add_event_dialog_controller_1 = require("./components/dialogs/add-event-dialog/add-event-dialog.controller");
const add_pallet_dialog_controller_1 = require("./components/dialogs/add-pallet-dialog/add-pallet-dialog.controller");
const additional_services_dialog_controller_1 = require("./components/dialogs/additional-services-dialog/additional-services-dialog.controller");
const auto_complete_dialog_controller_1 = require("./components/dialogs/auto-complete-dialog/auto-complete-dialog.controller");
const create_job_dialog_controller_1 = require("./components/dialogs/create-job-dialog/create-job-dialog.controller");
const date_range_dialog_controller_1 = require("./components/dialogs/date-range-dialog/date-range-dialog.controller");
const edit_parcel_dimensions_dialog_controller_1 = require("./components/dialogs/edit-parcel-dimensions-dialog/edit-parcel-dimensions-dialog.controller");
const parcel_visualization_directive_1 = require("./components/dialogs/edit-parcel-dimensions-dialog/parcel-visualization.directive");
const feature_in_development_dialog_controller_1 = require("./components/dialogs/feature-in-development-dialog/feature-in-development-dialog.controller");
const send_message_dialog_controller_1 = require("./components/dialogs/send-message-dialog/send-message-dialog.controller");
const select_dialog_controller_1 = require("./components/dialogs/select-dialog/select-dialog.controller");
const map_dialog_controller_1 = require("./components/dialogs/map-dialog/map-dialog.controller");
const nationwide_layout_service_1 = require("./components/Nationwide/services/nationwide-layout.service");
const mega_map_controller_1 = require("./components/overview/mega-map/mega-map.controller");
const open_jobs_controller_1 = require("./components/overview/open-jobs/open-jobs.controller");
const overview_filters_service_1 = __importDefault(require("./components/overview/services/overview-filters.service"));
const overview_controller_1 = require("./components/overview/overview.controller");
const overview_service_1 = __importDefault(require("./components/overview/overview.service"));
const prebook_service_1 = __importDefault(require("./components/prebooks/prebook.service"));
const feature_in_development_dialog_service_1 = require("./components/dialogs/feature-in-development-dialog/feature-in-development-dialog.service");
const task_dashboard_controller_1 = require("./components/task-dashboard/task-dashboard.controller");
const tasks_dashboard_service_1 = __importDefault(require("./components/task-dashboard/tasks-dashboard.service"));
const config_service_1 = __importDefault(require("./services/config.service"));
const dispatch_core_service_1 = __importDefault(require("./services/dispatch-core.service"));
const dispatch_executor_service_1 = __importDefault(require("./services/dispatch-executor.service"));
const getUsStates_service_1 = __importDefault(require("./services/getUsStates.service"));
const greeting_service_1 = __importDefault(require("./services/greeting.service"));
const open_job_dispatch_service_1 = __importDefault(require("./services/open-job-dispatch.service"));
const rate_job_service_1 = __importDefault(require("./services/rate-job.service"));
const ToastrService_1 = __importDefault(require("./services/ToastrService"));
const select_dialog_service_1 = require("./components/dialogs/select-dialog/select-dialog.service");
const event_group_dialog_controller_1 = require("./components/dialogs/event-group-dialog/event-group-dialog.controller");
const event_group_dialog_service_1 = require("./components/dialogs/event-group-dialog/event-group-dialog.service");
const edit_date_time_dialog_controller_1 = require("./components/dialogs/edit-date-time-dialog/edit-date-time-dialog.controller");
const edit_date_time_dialog_service_1 = require("./components/dialogs/edit-date-time-dialog/edit-date-time-dialog.service");
const dispatch_map_directive_1 = __importDefault(require("./components/common/dispatch-map/dispatch-map.directive"));
const app = angular.module("uDispatch", ["ui.router", "ct.ui.router.extras",
    "angularResizable", "ui.sortable", "ui.bootstrap", "ui.bootstrap.pagination",
    "ui.bootstrap.contextMenu", "cfp.hotkeys", "ui.timepicker", "pickadate", "ngMap",
    "ngMapAutocomplete", "angularjs-dropdown-multiselect", "heremaps", "ngAnimate",
    "ngMessages", "ngSanitize", "ngMaterial", "angularPromiseButtons", "ng-mfb",
    "md.time.picker", "angularMoment", "md.data.table", "ngFileUpload", "hereMapTracking.services", "hereMapTracking.components"]);
// Constants
app
    .constant("APP_CONFIG", {
    US_Customer: serverConfig.isUSCustomer,
    US_Coordinates_Center: {
        lat: 39.8283,
        lng: -98.5795
    },
    NZ_Coordinates_Center: {
        lat: -36.8485,
        lng: 174.7633
    }
})
    .constant("AppPages", app_pages_enum_1.AppPages);
// Directives
app
    .directive("rightClick", ["$document", ($document) => {
        $document.on('contextmenu', (event) => {
            const target = event.target;
            if (target.hasAttribute("right-click")) {
                event.preventDefault();
                event.stopPropagation();
                return false;
            }
        });
        return (scope, el, attrs) => {
            el.bind("contextmenu", (e) => {
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
    .config(["HereMapsConfigProvider", (HereMapsConfigProvider) => {
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
    .config(["$qProvider", ($qProvider) => {
        $qProvider.errorOnUnhandledRejections(false);
    }])
    .config(["$mdDateLocaleProvider", "moment", "APP_CONFIG", ($mdDateLocaleProvider, moment, APP_CONFIG) => {
        if (!APP_CONFIG.US_Customer) {
            // Set locale to New Zealand English
            moment.locale("en-nz");
            $mdDateLocaleProvider.formatDate = (date) => moment(date).format("DD/MM/YYYY");
            $mdDateLocaleProvider.parseDate = (dateString) => {
                const m = moment(dateString, "DD/MM/YYYY", true);
                return m.isValid() ? m.toDate() : null;
            };
            $mdDateLocaleProvider.isDateComplete = (dateString) => moment(dateString, "DD/MM/YYYY", true).isValid();
            // First day of the week is Monday (1) in New Zealand
            $mdDateLocaleProvider.firstDayOfWeek = 1;
            // Define month names
            $mdDateLocaleProvider.months = moment.months();
            // Define day names (start with Monday)
            $mdDateLocaleProvider.days = moment.weekdays(true);
            // Define short day names (start with Monday)
            $mdDateLocaleProvider.shortDays = moment.weekdaysShort(true);
            // Month header formatter
            $mdDateLocaleProvider.monthHeaderFormatter = (date) => moment(date).format("MMMM YYYY");
            // Week number formatter
            $mdDateLocaleProvider.weekNumberFormatter = (weekNumber) => `Week ${weekNumber}`;
            $mdDateLocaleProvider.msgCalendar = "Calendar";
            $mdDateLocaleProvider.msgOpenCalendar = "Open calendar";
            // Date-picker specific display and parsing
            $mdDateLocaleProvider.dateFormat = "dd/MM/yyyy";
            $mdDateLocaleProvider.inputDateFormat = "dd/MM/yyyy";
            // Long date format (e.g., "14 July 2023")
            $mdDateLocaleProvider.longDateFormat = (date) => moment(date).format("D MMMM YYYY");
            // Short time format
            $mdDateLocaleProvider.timeFormat = "h:mm a";
        }
    }]);
// Components
app.component('dfrntLoader', dfrnt_loader_component_1.DfrntLoaderComponent);
app.component("jobDetailWidget", job_details_component_1.JobDetailComponent);
app.component("materialSidenav", side_nav_component_1.MaterialSidenavComponent);
app.component("podPhotoViewer", pod_photo_viewer_component_1.PodPhotoViewerComponent);
app.component("openJobsWidget", open_jobs_controller_1.openJobsComponent);
app.component("dispatchMap", dispatch_map_directive_1.default);
// Dialogs
app.controller("AddEventDialogController", add_event_dialog_controller_1.AddEventDialogController);
app.controller("AddNotesDialogController", add_notes_dialog_controller_1.AddNotesDialogController);
app.controller("PalletDialogController", add_pallet_dialog_controller_1.PalletDialogController);
app.controller("AdditionalServicesDialogController", additional_services_dialog_controller_1.AdditionalServicesDialogController);
app.controller("AutoCompleteDialogController", auto_complete_dialog_controller_1.AutoCompleteDialogController);
app.controller("CreateJobDialogController", create_job_dialog_controller_1.CreateJobDialogController);
app.controller("DateRangeDialogController", date_range_dialog_controller_1.DateRangeDialogController);
app.controller("EditParcelDimensionsDialogController", edit_parcel_dimensions_dialog_controller_1.EditParcelDimensionsDialogController);
app.controller("FeatureInDevelopmentDialogController", feature_in_development_dialog_controller_1.FeatureInDevelopmentDialogController);
app.controller("SendMessageDialogController", send_message_dialog_controller_1.SendMessageDialogController);
app.controller("SelectDialogController", select_dialog_controller_1.SelectDialogController);
app.controller("MapDialogController", map_dialog_controller_1.MapDialogController);
app.controller('EventGroupDialogController', event_group_dialog_controller_1.EventGroupDialogController);
app.controller("EditDateTimeDialogController", edit_date_time_dialog_controller_1.EditDateTimeDialogController);
// Directives
app.directive("contextMenu", job_context_menu_controller_1.ContextMenuDirective.factory());
app.directive("parcelVisualization", parcel_visualization_directive_1.ParcelVisualizationDirective.factory());
// Controllers
app.controller('HomeControl', home_controller_1.HomeController);
app.controller("megaMapController", mega_map_controller_1.MegaMapController);
app.controller("deliveryOverview", overview_controller_1.OverviewController);
app.controller("taskDashboardController", task_dashboard_controller_1.TaskDashboardController);
// Services
app.service("configService", config_service_1.default);
app.service("DispatchData", dispatch_core_service_1.default);
app.service("dispatchJobService", dispatch_executor_service_1.default);
app.service("UsStatesService", getUsStates_service_1.default);
app.service("greetingService", greeting_service_1.default);
app.service("openJobDispatchService", open_job_dispatch_service_1.default);
app.service("rateJobService", rate_job_service_1.default);
app.service("toastrService", ToastrService_1.default);
app.service("featureInDevelopmentDialogService", feature_in_development_dialog_service_1.FeatureInDevelopmentDialogService);
app.service("NationwideLayoutService", nationwide_layout_service_1.NationwideLayoutService);
app.service("overviewFiltersService", overview_filters_service_1.default);
app.service("overviewService", overview_service_1.default);
app.service("uPBData", prebook_service_1.default);
app.service("tasksDashboardsService", tasks_dashboard_service_1.default);
app.service('selectDialogService', select_dialog_service_1.SelectDialogService);
app.service('eventGroupDialogService', event_group_dialog_service_1.EventGroupDialogService);
app.service("editDateTimeDialogService", edit_date_time_dialog_service_1.EditDateTimeDialogService);
exports.default = app;
