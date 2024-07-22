angular
    .module("uDispatch", [
        "ui.router",
        "ct.ui.router.extras",
        "angularResizable",
        "ui.sortable",
        "ui.bootstrap",
        "ui.bootstrap.pagination",
        "ui.bootstrap.contextMenu",
        "cfp.hotkeys",
        "ui.timepicker",
        'pickadate',
        "ngMap",
        "ngMapAutocomplete",
        'angularjs-dropdown-multiselect',
        'heremaps',
        'ngAnimate',
        'ngMessages',
        'ngSanitize',
        'ngMaterial',
        'angularPromiseButtons',
        'cp.ngConfirm'
    ])
    .config($mdThemingProvider => {
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
            'contrastDarkColors': [
                '50',
                '100',
                '200',
                '300',
                '400',
                '500',
                '600',
                '700',
                '800',
                '900',
                'A100',
                'A200',
                'A400',
                'A700'
            ],
            'contrastLightColors': []
        });



        // Material Theme
        $mdThemingProvider.theme('default')
            .primaryPalette('urgentPrimary')
            .accentPalette('grey');

        // Register Toast themes
        $mdThemingProvider.theme("success-toast")
        $mdThemingProvider.theme("warning-toast")
        $mdThemingProvider.theme("error-toast")
    })
    .directive('rightClick', () => {
        document.oncontextmenu = e => {
            if (e.target.hasAttribute('right-click')) {
                e.stopPropagation();
                return false;
            }
        };
        return (scope, el, attrs) => {
            el.bind('contextmenu', e => {
                scope.$apply(
                    scope.$eval(attrs.action, {
                        'event': e
                    })
                );
                //alert(attrs.alert);

            });
        }
    })
    .config(["$urlRouterProvider", "$stateProvider", ($urlRouterProvider, $stateProvider) => {
        $urlRouterProvider.otherwise("/");

        $stateProvider
            .state("home",
                {
                    url: "/",
                    templateUrl: "app/components/home/homeView.html",
                    controller: "HomeControl"
                })
            .state('nw',
                {
                    url: '/Nationwide',
                    templateUrl: 'app/components/Nationwide/nationwideView.html',
                    controller: 'NationwideControl',
                    reloadOnSearch: false
                })
            .state('cs',
                {
                    url: '/CS',
                    templateUrl: 'app/components/CS/csView.html',
                    controller: 'CSControl',
                    reloadOnSearch: false
                })
            .state('prebooks',
                {
                    url: '/prebooks',
                    templateUrl: 'app/components/prebooks/prebookView.html',
                    controller: 'PBControl',
                    reloadOnSearch: false
                });
    }]);
