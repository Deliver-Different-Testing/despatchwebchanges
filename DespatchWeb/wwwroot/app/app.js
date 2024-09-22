angular
    .module('uDispatch', [
        'ui.router', 'ct.ui.router.extras', 'angularResizable',
        'ui.sortable', 'ui.bootstrap', 'ui.bootstrap.pagination',
        'ui.bootstrap.contextMenu', 'cfp.hotkeys', 'ui.timepicker',
        'pickadate', 'ngMap', 'ngMapAutocomplete', 'angularjs-dropdown-multiselect',
        'heremaps', 'ngAnimate', 'ngMessages', 'ngSanitize', 'ngMaterial',
        'angularPromiseButtons', 'ng-mfb', 'md.time.picker', 'angularMoment',
        'md.data.table', 'ngFileUpload'])
    .constant('APP_CONFIG', {
        US_Customer: true
    })
    .config(['$mdThemingProvider', $mdThemingProvider => {
        $mdThemingProvider.definePalette('urgentPrimary', {
            '50': 'fffbe0',
            '100': 'fef5b3',
            '200': 'feee80',
            '300': 'fee74d',
            '400': 'fde226',
            '500': 'fddd00',
            '600': 'fdd900',
            '700': 'fcd400',
            '800': 'fccf00',
            '900': 'fcc700',
            'A100': 'ffffff',
            'A200': 'fffbef',
            'A400': 'ffefbc',
            'A700': 'ffe9a2',
            'contrastDefaultColor': 'light',
            'contrastDarkColors': ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', 'A100', 'A200', 'A400', 'A700'],
            'contrastLightColors': []
        });

        $mdThemingProvider.definePalette('urgentAccent', {
            '50': 'ececec',
            '100': 'cecece',
            '200': 'aeaeae',
            '300': '8e8e8e',
            '400': '757575',
            '500': '5d5d5d',
            '600': '555555',
            '700': '4b4b4b',
            '800': '414141',
            '900': '303030',
            'A100': '070406',
            'A200': '070406',
            'A400': '070406',
            'A700': '000000',
            'contrastDefaultColor': 'light',
            'contrastDarkColors': ['50', '100', '200', '300', 'A100', 'A200', 'A400', 'A700'],
            'contrastLightColors': ['400', '500', '600', '700', '800', '900']
        });


        // Material Theme
        $mdThemingProvider.theme('default')
            .primaryPalette('urgentAccent')
            .accentPalette('urgentPrimary');

        // Register Toast themes
        $mdThemingProvider.theme('success-toast')
        $mdThemingProvider.theme('warning-toast')
        $mdThemingProvider.theme('error-toast')
    }])
    .directive('rightClick', ['$document', $document => {
        $document.oncontextmenu = event => {
            if (event.target.hasAttribute('right-click')) {
                event.stopPropagation();
                return false;
            }
        };
        return (scope, el, attrs) => {
            el.bind('contextmenu', e => {
                scope.$apply(scope.$eval(attrs.action, {
                    'event': e
                }));
            });
        }
    }])
    .config(['HereMapsConfigProvider', HereMapsConfigProvider => {
        HereMapsConfigProvider.setOptions({
            'app_id': 'bBPfh2x8Cauun3ygLMAx',
            'app_code': 'yjfwTdkin_R2rGXYTrwWVg',
            'useHTTPS': true,
            'useCIT': true,
            'mapTileConfig': {
                metadataQueryParams: {
                    'lg2': 'ara'
                }
            }
        });
    }])
    .config(['$qProvider', $qProvider => {
        $qProvider.errorOnUnhandledRejections(false);
    }])
    .config(['$mdDateLocaleProvider', 'moment', 'APP_CONFIG',
        ($mdDateLocaleProvider, moment, APP_CONFIG) => {
            if (!APP_CONFIG.US_Customer) {
                // Set locale to New Zealand English
                moment.locale('en-nz');

                $mdDateLocaleProvider.formatDate = date => moment(date).format('DD/MM/YYYY');

                $mdDateLocaleProvider.parseDate = (dateString) => {
                    const m = moment(dateString, 'DD/MM/YYYY', true);
                    return m.isValid() ? m.toDate() : null;
                };

                $mdDateLocaleProvider.isDateComplete = dateString =>
                    moment(dateString, 'DD/MM/YYYY', true).isValid();

                // First day of the week is Monday (1) in New Zealand
                $mdDateLocaleProvider.firstDayOfWeek = 1;

                // Define month names
                $mdDateLocaleProvider.months = moment.months();

                // Define day names (start with Monday)
                $mdDateLocaleProvider.days = moment.weekdays(true);

                // Define short day names (start with Monday)
                $mdDateLocaleProvider.shortDays = moment.weekdaysShort(true);

                // Month header formatter
                $mdDateLocaleProvider.monthHeaderFormatter = (date) =>
                    moment(date).format('MMMM YYYY');

                // Week number formatter
                $mdDateLocaleProvider.weekNumberFormatter = (weekNumber) =>
                    `Week ${weekNumber}`;

                $mdDateLocaleProvider.msgCalendar = 'Calendar';
                $mdDateLocaleProvider.msgOpenCalendar = 'Open calendar';

                // Date-picker specific display and parsing
                $mdDateLocaleProvider.dateFormat = 'dd/MM/yyyy';
                $mdDateLocaleProvider.inputDateFormat = 'dd/MM/yyyy';

                // Long date format (e.g., "14 July 2023")
                $mdDateLocaleProvider.longDateFormat = date =>
                    moment(date).format('D MMMM YYYY');

                // Short time format
                $mdDateLocaleProvider.timeFormat = 'h:mm a';
            }
        }])
    .factory('versionUrl', ['APP_VERSION', APP_VERSION => url => url + (url.indexOf('?') === -1 ? '?' : '&') + 'v=' + APP_VERSION]);
