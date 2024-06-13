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
	.config(function($mdThemingProvider) {
		$mdThemingProvider.definePalette('urgent', {
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

		$mdThemingProvider.theme('default')
			.primaryPalette('urgent')
	})
	.directive('rightClick', function () {

		document.oncontextmenu = function (e) {
            if (e.target.hasAttribute('right-click')) {
                e.stopPropagation();
				return false;
			}
		};
		return function (scope, el, attrs) {
			el.bind('contextmenu', function (e) {
				scope.$apply(
					scope.$eval(attrs.action, {
						'event': e
					})
				);
				//alert(attrs.alert);

			});
		}
	})
	.config(["$urlRouterProvider", "$stateProvider", function($urlRouterProvider, $stateProvider) {
		$urlRouterProvider.otherwise("/");

        $stateProvider
            .state("home",
                {
                    url: "/",
                    templateUrl: "app/components/home/homeView.html?v=1.44",
                    controller: "HomeControl"
				})
			.state('nw',
                {
                    url: '/Nationwide',
                    templateUrl: 'app/components/Nationwide/nationwideView.html?v=1.7',
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
                    templateUrl: 'app/components/prebooks/prebookView.html?v=1.1',
                    controller: 'PBControl',
                    reloadOnSearch: false
                });


    }]);
