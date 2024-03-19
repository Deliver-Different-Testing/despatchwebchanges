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
		'angularPromiseButtons',
		
        'cp.ngConfirm'
	])
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
                    templateUrl: "app/components/home/homeView.html?v=1.45",
                    controller: "HomeControl"
				})
			.state('nw',
                {
                    url: '/Nationwide',
                    templateUrl: 'app/components/Nationwide/nationwideView.html?v=1.8',
                    controller: 'NationwideControl',
                    reloadOnSearch: false
                })
            .state('cs',
                {
                    url: '/CS',
                    templateUrl: 'app/components/CS/csView.html?v=1.23',
					controller: 'CSControl',
                    reloadOnSearch: false
				})
            .state('prebooks',
                {
                    url: '/prebooks',
                    templateUrl: 'app/components/prebooks/prebookView.html?v=1.2',
                    controller: 'PBControl',
                    reloadOnSearch: false
                });


    }]);