import {AppConfig} from "./interfaces/app-config.interface";
import {AppPages} from "./enums/app-pages.enum";
import {PodPhotoViewerComponent} from "./components/common/pod-photo-viewer/pod-photo-viewer.component";
import {MaterialSidenavComponent} from "./components/common/side-nav/side-nav.component";
import {AutoCompleteDialogController} from "./components/dialogs/auto-complete-dialog/auto-complete-dialog.controller";
import {CreateJobDialogController} from "./components/dialogs/create-job-dialog/create-job-dialog.controller";
import {
    EditParcelDimensionsDialogController
} from "./components/dialogs/edit-parcel-dimensions-dialog/edit-parcel-dimensions-dialog.controller";
import {
    FeatureInDevelopmentDialogController
} from "./components/dialogs/feature-in-development-dialog/feature-in-development-dialog.controller";
import {SelectDialogController} from "./components/dialogs/select-dialog/select-dialog.controller";
import ConfigService from "./services/config.service";
import DispatchCoreService from "./services/dispatch-core.service";
import NavigationService from "./services/navigation.service";
import ToastrService from "./services/toastr.service";
import {SelectDialogService} from "./components/dialogs/select-dialog/select-dialog.service";
import {EventGroupDialogController} from "./components/dialogs/event-group-dialog/event-group-dialog.controller";
import {EventGroupDialogService} from "./components/dialogs/event-group-dialog/event-group-dialog.service";
import {
    EditDateTimeDialogController
} from "./components/dialogs/edit-date-time-dialog/edit-date-time-dialog.controller";
import {EditDateTimeDialogService} from "./components/dialogs/edit-date-time-dialog/edit-date-time-dialog.service";
import EditAddressDialogController from "./components/dialogs/edit-address-dialog/edit-address-dialog.controller";
import {EditAddressDialogService} from "./components/dialogs/edit-address-dialog/edit-address-dialog.service";
import PriceBreakdownDialogService from "./components/dialogs/price-breakdown-dialog/price-breakdown-dialog.service";
import JobDetailComponent from "./components/common/job-details/job-details.component";
import JobFileUploadController from "./components/dialogs/job-file-upload-dialog/job-file-upload.controller";
import JobFileUploadDialogService from "./components/dialogs/job-file-upload-dialog/job-file-upload-dialog.service";
import NoteManagementDialogService from "./components/dialogs/note-management-dialog/note-management.dialog.service";
import NoteManagementDialogController
    from "./components/dialogs/note-management-dialog/note-management-dialog.component";
import NoteService from "./services/notes.service";
import RouterConfig from "./routes";
import ThemeConfig from "./materialTheme";
import AddEventDialogController from "./components/dialogs/add-event-dialog/add-event-dialog.controller";
import AddEventDialogService from "./components/dialogs/add-event-dialog/add-event-dialog.service";
import {
    bytesFilter,
    momentFormatFilter,
    replaceFilter, timezoneLongFilter, timezoneShortFilter
} from "./filters";
import StickyNoteComponent from "./components/common/sticky-notes/sticky-notes.component";
import EditParcelDimensionsDialogService
    from "./components/dialogs/edit-parcel-dimensions-dialog/edit-parcel-dimensions-dialog.service";
import AutoCompleteDialogService from "./components/dialogs/auto-complete-dialog/auto-complete-dialog.service";
import JobAddStopService from "./services/job-add-stop.service";
import AddressLookupService from "./services/address-lookup.service";
import dayjs from "dayjs";
import 'dayjs/locale/en';
import NoDataComponent from "./components/common/no-data/no-data.component";
import TruckCourierStatusDialogController
    from "./components/dialogs/truck-courier-status-dialog/truck-courier-status-dialog.controller";
import TruckCourierStatusDialogService
    from "./components/dialogs/truck-courier-status-dialog/truck-courier-status-dialog.service";
import MessagingService from "./services/messaging.service";
import MessagingDialogService from "./components/dialogs/messaging-dialog/messaging-dialog.service";
import MessagingDialogController from "./components/dialogs/messaging-dialog/messaging-dialog.controller";
import CustomUrlService from "./services/custom-url-service";
import ResolutionWarningService from "./components/dialogs/resolution-warning-dialog/resolution-warning.service";
import VoidJobConfirmationDialogController
    from "./components/dialogs/void-job-confirmation-dialog/void-job-confirmation-dialog.controller";
import VoidJobConfirmationDialogService
    from "./components/dialogs/void-job-confirmation-dialog/void-job-confirmation-dialog.service";

const app = (window as any).uDispatchApp;

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
        appConfig: AppConfig
    ): void => {
        const themeConfig = new ThemeConfig($mdThemingProvider, appConfig);
        themeConfig.configure();
    }
]);

// Configs
app.config(["$qProvider", ($qProvider: angular.IQProvider) => {
    $qProvider.errorOnUnhandledRejections(false);
}])
    .config(["$mdDateLocaleProvider", "APP_CONFIG", (
        $mdDateLocaleProvider: angular.material.IDateLocaleProvider,
        appConfig: AppConfig) => {
        if (!appConfig.US_Customer) {
            dayjs().locale("en-nz");

            $mdDateLocaleProvider.formatDate = (date: Date) => dayjs(date).format("DD/MM/YYYY");

            $mdDateLocaleProvider.parseDate = (dateString: string) => {
                const m = dayjs(dateString, "DD/MM/YYYY", true);
                return m.isValid() ? m.toDate() : new Date();
            };

            $mdDateLocaleProvider.firstDayOfWeek = 1;

            function getAllMonthNames() {
                const months = [];
                for (let i = 0; i < 12; i++) {
                    months.push(dayjs().month(i).format('MMMM'));
                }
                return months;
            }

            function getAllWeekdays(startWithMonday = false) {
                const weekdays = [];
                let startDay = startWithMonday ? 1 : 0; // 0 = Sunday, 1 = Monday

                for (let i = 0; i < 7; i++) {
                    const day = (startDay + i) % 7;
                    weekdays.push(dayjs().day(day).format('dddd'));
                }
                return weekdays;
            }

            function getShortWeekdays(startWithMonday = false) {
                const shortDays = [];
                let startDay = startWithMonday ? 1 : 0;

                for (let i = 0; i < 7; i++) {
                    const day = (startDay + i) % 7;
                    shortDays.push(dayjs().day(day).format('ddd'));
                }
                return shortDays;
            }

            $mdDateLocaleProvider.months = getAllMonthNames();
            $mdDateLocaleProvider.days = getAllWeekdays(true);
            $mdDateLocaleProvider.shortDays = getShortWeekdays(true);
            $mdDateLocaleProvider.monthHeaderFormatter = (date: Date) => dayjs(date).format("MMMM YYYY");
            $mdDateLocaleProvider.weekNumberFormatter = (weekNumber: number) => `Week ${weekNumber}`;
            $mdDateLocaleProvider.msgCalendar = "Calendar";
            $mdDateLocaleProvider.msgOpenCalendar = "Open calendar";
        }
    }]);

app.config(["$logProvider", ($logProvider: angular.ILogProvider) => {
    // Disable debug logging in production
    const isProduction = process.env.NODE_ENV === "production";
    $logProvider.debugEnabled(!isProduction);
}]);

// Filters
app.filter("bytes", () => bytesFilter);
app.filter("replace", () => replaceFilter);
app.filter('momentFormat', () => momentFormatFilter);
app.filter('timezoneShort', () => timezoneShortFilter);
app.filter('timezoneLongFilter', () => timezoneLongFilter);

// Components
app.component("jobDetailWidget", JobDetailComponent);
app.component("materialSidenav", MaterialSidenavComponent);
app.component("podPhotoViewer", PodPhotoViewerComponent);
app.component("noData", NoDataComponent);
app.component("stickyNote", StickyNoteComponent);

// Dialogs
app.controller("AddEventDialogController", AddEventDialogController);
app.controller("AutoCompleteDialogController", AutoCompleteDialogController);
app.controller("CreateJobDialogController", CreateJobDialogController);
app.controller("EditParcelDimensionsDialogController", EditParcelDimensionsDialogController);
app.controller("FeatureInDevelopmentDialogController", FeatureInDevelopmentDialogController);
app.controller("SelectDialogController", SelectDialogController);
app.controller('EventGroupDialogController', EventGroupDialogController);
app.controller("EditDateTimeDialogController", EditDateTimeDialogController);
app.controller("EditAddressDialogController", EditAddressDialogController);
app.controller("jobFileUploadController", JobFileUploadController);
app.controller("jobNoteEditorDialogController", NoteManagementDialogController);
app.controller("TruckCourierStatusDialogController", TruckCourierStatusDialogController);
app.controller("messagingDialogController", MessagingDialogController);
app.controller("voidJobConfirmationDialogController", VoidJobConfirmationDialogController);

// Services
app.service("configService", ConfigService);
app.service("DispatchData", DispatchCoreService);
app.service("navigationService", NavigationService);
app.service("toastrService", ToastrService);
app.service('selectDialogService', SelectDialogService);
app.service('eventGroupDialogService', EventGroupDialogService);
app.service("editDateTimeDialogService", EditDateTimeDialogService);
app.service("editAddressDialogService", EditAddressDialogService);
app.service("priceBreakdownDialogService", PriceBreakdownDialogService);
app.service("jobFileUploadDialogService", JobFileUploadDialogService);
app.service("noteManagementDialogService", NoteManagementDialogService);
app.service("noteService", NoteService);
app.service("addEventDialogService", AddEventDialogService);
app.service("editParcelDimensionsDialogService", EditParcelDimensionsDialogService);
app.service("autoCompleteDialogService", AutoCompleteDialogService);
app.service("jobAddStopService", JobAddStopService);
app.service("addressLookupService", AddressLookupService);
app.service("truckCourierStatusDialogService", TruckCourierStatusDialogService);
app.service("messagingService", MessagingService);
app.service("messagingDialogService", MessagingDialogService);
app.service('resolutionWarningService', ResolutionWarningService);
app.service('customUrlService', CustomUrlService);
app.service('voidJobConfirmationDialogService', VoidJobConfirmationDialogService);

app.run(['resolutionWarningService', (resolutionWarningService: ResolutionWarningService) => {
    resolutionWarningService.checkAndShowResolutionWarning();
}]);

export default app;
