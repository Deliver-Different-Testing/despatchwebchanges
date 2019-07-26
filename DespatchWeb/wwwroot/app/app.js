angular
	.module("uDispatch", [
		"ui.router",
		"ct.ui.router.extras",
		"angularResizable",
		"ui.sortable",
		"ui.bootstrap.contextMenu", 
		"cfp.hotkeys",
        "ui.timepicker",
        "ngMap",
        "ngMapAutocomplete",
        'angularjs-dropdown-multiselect',
        'heremaps',
        'ngAnimate',
        'angularPromiseButtons'
	])
	.config(["$urlRouterProvider", "$stateProvider", function($urlRouterProvider, $stateProvider) {
		$urlRouterProvider.otherwise("/");

		$stateProvider
			.state("home",
				{
					url: "/",
					templateUrl: "app/components/home/homeView.html?v=1.3",
					controller: "HomeControl"
				});
		

	}]);