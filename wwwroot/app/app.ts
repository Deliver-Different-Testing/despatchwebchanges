const app = angular.module("uDispatch", ["ui.router", "ct.ui.router.extras",
    "angularResizable", "ui.sortable", "ui.bootstrap", "ui.bootstrap.pagination",
    "ui.bootstrap.contextMenu", "cfp.hotkeys", "ui.timepicker", "pickadate", "ngMap",
    "ngMapAutocomplete", "angularjs-dropdown-multiselect", "heremaps", "ngAnimate",
    "ngMessages", "ngSanitize", "ngMaterial", "angularPromiseButtons", "ng-mfb",
    "md.time.picker", "angularMoment", "md.data.table", "ngFileUpload", "hereMapTracking.services", "hereMapTracking.components"]);

// Constants
app
    .constant("APP_CONFIG", {
        US_Customer: (serverConfig as any).isUSCustomer
    })
    .constant("AppPages", {
        Dispatch: 1,
        Domestic: 2,
        JobSearch: 3,
        Prebooks: 4
    });

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

export default app;
