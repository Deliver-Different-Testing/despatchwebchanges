import {IAppConfig} from "./interfaces/app-config.interface";
import {AppPage} from "./enums/app-pages.enum";
import "./react/components/common/pod-photo-viewer/pod-photo-viewer-react.module";
import "./react/components/dialogs/note-management-dialog/note-management-dialog-react.module";
import EditParcelDimensionsDialogController
    from "./components/dialogs/edit-parcel-dimensions-dialog/edit-parcel-dimensions-dialog.controller";
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
import {EditDateTimeDialogService} from "./components/dialogs/edit-date-time-dialog/edit-date-time-dialog.service";
import {EditAddressDialogService} from "./components/dialogs/edit-address-dialog/edit-address-dialog.service";
import PriceBreakdownDialogService from "./components/dialogs/price-breakdown-dialog/price-breakdown-dialog.service";
import JobDetailComponent from "./components/common/job-details/job-details.component";
import JobFileUploadController from "./components/dialogs/job-file-upload-dialog/job-file-upload.controller";
import JobFileUploadDialogService from "./components/dialogs/job-file-upload-dialog/job-file-upload-dialog.service";
import RouterConfig from "./routes";
import ThemeConfig from "./materialTheme";
import {bytesFilter, momentFormatFilter, replaceFilter, timezoneLongFilter, timezoneShortFilter} from "./filters";
import {StickyNotesReactComponent} from "./react/components/common/sticky-notes/sticky-notes-react.module";
import EditParcelDimensionsDialogService
    from "./components/dialogs/edit-parcel-dimensions-dialog/edit-parcel-dimensions-dialog.service";
import AutoCompleteDialogService from "./components/dialogs/auto-complete-dialog/auto-complete-dialog.service";
import JobAddStopService from "./services/job-add-stop.service";
import AddressLookupService from "./services/address-lookup.service";
import dayjs from "dayjs";
import 'dayjs/locale/en';
import 'dayjs/locale/en-nz';
import TablePaginationComponent from "./components/common/table-pagination/table-pagination.component";
import TruckCourierStatusDialogController
    from "./components/dialogs/truck-courier-status-dialog/truck-courier-status-dialog.controller";
import TruckCourierStatusDialogService
    from "./components/dialogs/truck-courier-status-dialog/truck-courier-status-dialog.service";
import MessagingDialogService from "./components/dialogs/messaging-dialog/messaging-dialog.service";
import CustomUrlService from "./services/custom-url.service";
import VoidJobConfirmationDialogService
    from "./components/dialogs/void-job-confirmation-dialog/void-job-confirmation-dialog.service";
import SwapPodsDialogService
    from "./components/dialogs/swap-pods-dialog/swap-pods-dialog.service";
import DayJsDatePickerComponent from "./components/common/dayjs-date-picker/dayjs-date-picker.component";
import DispatchExecutorService from "./services/dispatch-executor.service";
import {minutesToTimeFilter} from "./components/Nationwide/filters/minutesToTimeFilter";
import SimplePriceEditDialogService
    from "./components/dialogs/simple-price-edit-dialog/simple-price-edit-dialog.service";
import SimplePriceEditDialogController
    from "./components/dialogs/simple-price-edit-dialog/simple-price-edit-dialog.controller";
import BulkPriceUploadDialogService
    from "./components/dialogs/bulk-price-upload-dialog/bulk-price-upload-dialog.service";
import {TaskItemReactComponent} from "./react/components/common/task-item/task-item-react.module";
import {DriverLocationsReactComponent} from "./react/components/common/driver-locations/driver-locations-react.module";
import {NoDataReactComponent} from "./react/components/common/no-data/no-data-react.module";
import {
    FlightAgentDataTableReactComponent
} from "./react/components/common/flight-agent-data-table/flight-agent-data-table-react.module";
import reactAppShellDirective from "./components/common/react-app-shell/react-app-shell.directive";
import angular from 'angular';

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
    } as IAppConfig)
    .constant("AppPages", AppPage);

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
        appConfig: IAppConfig
    ): void => {
        const themeConfig = new ThemeConfig($mdThemingProvider, appConfig);
        themeConfig.configure();
    }
]);

// Set theme CSS custom properties based on the customer region
app.run(["APP_CONFIG", (appConfig: IAppConfig) => {
    const root = document.documentElement;
    if (appConfig.US_Customer) {
        root.style.setProperty('--theme-primary', '#2196f3');
        root.style.setProperty('--theme-primary-light', 'rgba(33, 150, 243, 0.15)');
        root.style.setProperty('--theme-primary-medium', 'rgba(33, 150, 243, 0.3)');
        root.style.setProperty('--theme-primary-strong', 'rgba(33, 150, 243, 0.5)');
        document.body.classList.add('theme-us');
    } else {
        // Match MUI theme urgentPrimaryPalette[500] - warm amber gold
        root.style.setProperty('--theme-primary', '#f4c430');
        root.style.setProperty('--theme-primary-light', 'rgba(244, 196, 48, 0.15)');
        root.style.setProperty('--theme-primary-medium', 'rgba(244, 196, 48, 0.3)');
        root.style.setProperty('--theme-primary-strong', 'rgba(244, 196, 48, 0.5)');
        document.body.classList.add('theme-nz');
    }
}]);

// Security Configuration
app.config(["$httpProvider", ($httpProvider: angular.IHttpProvider) => {
    // Add header to identify AJAX requests (helps backend distinguish from form submissions)
    if (!$httpProvider.defaults.headers) return;
    $httpProvider.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';
}]);

app.config(["$sceProvider", ($sceProvider: angular.ISCEProvider) => {
    // SCE provides automatic XSS protection by requiring trusted values for dangerous contexts
    $sceProvider.enabled(true);
}]);

// CVE-2025-0716 Mitigation: Stricter URL sanitization for href and img sources
app.config(["$compileProvider", ($compileProvider: angular.ICompileProvider) => {
    // Only allow safe protocols for href attributes (blocks javascript:, data: URIs in links)
    $compileProvider.aHrefSanitizationTrustedUrlList(/^\s*(https?|mailto|tel):/);

    // Only allow safe protocols and trusted data URIs for image sources
    // Allows: http/https URLs, and data URIs for common image formats only
    $compileProvider.imgSrcSanitizationTrustedUrlList(/^\s*(https?:|data:image\/(png|jpg|jpeg|gif|webp|svg\+xml);base64,)/);

    // Disable debug info in production for better performance and security
    // Debug info exposes scope data on DOM elements which could leak sensitive data
    if ((window as any).serverConfig?.isProduction) {
        $compileProvider.debugInfoEnabled(false);
    }
}]);

// Configs
app.config(["$qProvider", ($qProvider: angular.IQProvider) => {
    $qProvider.errorOnUnhandledRejections(false);
}])
    .config(["$mdDateLocaleProvider", "APP_CONFIG", (
        $mdDateLocaleProvider: angular.material.IDateLocaleProvider,
        appConfig: IAppConfig) => {
        if (!appConfig.US_Customer) {
            dayjs.locale("en-nz");

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

// Filters
app.filter("bytes", () => bytesFilter);
app.filter("replace", () => replaceFilter);
app.filter('momentFormat', () => momentFormatFilter);
app.filter('timezoneShort', () => timezoneShortFilter);
app.filter('timezoneLongFilter', () => timezoneLongFilter);
app.filter('minutesToTime', () => minutesToTimeFilter);

// Components
app.component("jobDetailWidget", JobDetailComponent);
app.component("tablePagination", TablePaginationComponent);
app.component("stickyNoteReact", StickyNotesReactComponent);
app.component("customDatePicker", DayJsDatePickerComponent);
app.component("taskItemReact", TaskItemReactComponent);
app.component("driverLocationsReact", DriverLocationsReactComponent);
app.component("noDataReact", NoDataReactComponent);
app.component("flightAgentDataTableReact", FlightAgentDataTableReactComponent);

// Directives
app.directive("reactAppShell", reactAppShellDirective);

// Dialogs
app.controller("EditParcelDimensionsDialogController", EditParcelDimensionsDialogController);
app.controller("FeatureInDevelopmentDialogController", FeatureInDevelopmentDialogController);
app.controller("SelectDialogController", SelectDialogController);
app.controller('EventGroupDialogController', EventGroupDialogController);
app.controller("jobFileUploadController", JobFileUploadController);
app.controller("TruckCourierStatusDialogController", TruckCourierStatusDialogController);
app.controller("simplePriceEditDialogController", SimplePriceEditDialogController);

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
app.service("editParcelDimensionsDialogService", EditParcelDimensionsDialogService);
app.service("autoCompleteDialogService", AutoCompleteDialogService);
app.service("jobAddStopService", JobAddStopService);
app.service("addressLookupService", AddressLookupService);
app.service("truckCourierStatusDialogService", TruckCourierStatusDialogService);
app.service("messagingDialogService", MessagingDialogService);
app.service('customUrlService', CustomUrlService);
app.service('voidJobConfirmationDialogService', VoidJobConfirmationDialogService);
app.service('swapPodsDialogService', SwapPodsDialogService);
app.service('simplePriceEditDialogService', SimplePriceEditDialogService);
app.service('bulkPriceUploadDialogService', BulkPriceUploadDialogService);
app.service('dispatchJobService', DispatchExecutorService);

export default app;
