angular
    .module('uDispatch', [
        'ui.router', 'ct.ui.router.extras', 'angularResizable',
        'ui.sortable', 'ui.bootstrap', 'ui.bootstrap.pagination',
        'ui.bootstrap.contextMenu', 'cfp.hotkeys', 'ui.timepicker',
        'pickadate', 'ngMap', 'ngMapAutocomplete', 'angularjs-dropdown-multiselect',
        'heremaps', 'ngAnimate', 'ngMessages', 'ngSanitize', 'ngMaterial',
        'angularPromiseButtons','ng-mfb', 'md.time.picker', 'angularMoment',
        'md.data.table', 'ngFileUpload'])
    .constant('APP_CONFIG', {
        US_Customer: true
    })
    .config(['$mdThemingProvider', $mdThemingProvider => {
        $mdThemingProvider.definePalette('urgentPrimary', {
            '50': 'e0f8ff',
            '100': 'b3e8ff',
            '200': '80d9ff',
            '300': '4dc9ff',
            '400': '26baff',
            '500': '76EAFE',
            '600': '00a8f3',
            '700': '0099e0',
            '800': '0089cc',
            '900': '0079b8',
            'A100': 'ffffff',
            'A200': 'd1ecff',
            'A400': '9ed8ff',
            'A700': '6bc4ff',
            'contrastDefaultColor': 'light',
            'contrastDarkColors': ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', 'A100', 'A200', 'A400', 'A700'],
            'contrastLightColors': []
         });

        $mdThemingProvider.definePalette('urgentAccent', {
            '50': 'e0f8ff',
            '100': 'b3e8ff',
            '200': '80d9ff',
            '300': '4dc9ff',
            '400': '26baff',
            '500': '76EAFE',
            '600': '00a8f3',
            '700': '0099e0',
            '800': '0089cc',
            '900': '0079b8',
            'A100': 'ffffff',
            'A200': 'd1ecff',
            'A400': '9ed8ff',
            'A700': '6bc4ff',
            'contrastDefaultColor': 'light',
            'contrastDarkColors': [
                '50', '100', '200', '300', '400', '500',
                '600', '700', '800', '900',
                'A100', 'A200', 'A400', 'A700'
            ],
            'contrastLightColors': ['400', '500', '600', '700', '800', '900']
        });


        // Material Theme
        $mdThemingProvider.theme('default')
            .primaryPalette('urgentPrimary')
            .accentPalette('urgentAccent');

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
            'app_id': HMID,
            'app_code': HMCD,
            'useHTTPS': true,
            'useCIT': true,
            'mapTileConfig': {
                metadataQueryParams: {
                    'lg2': 'ara'
                }
            }
        });
    }])
    .factory('versionUrl', ['APP_VERSION', APP_VERSION => url => url + (url.indexOf('?') === -1 ? '?' : '&') + 'v=' + APP_VERSION]);