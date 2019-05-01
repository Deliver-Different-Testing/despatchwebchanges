angular
	.module("uDispatch", [
		"ui.router",
		"ct.ui.router.extras",
		"angularResizable",
		"ui.sortable",
		"ui.bootstrap.contextMenu", 
		"cfp.hotkeys",
		"ui.timepicker",
		"ngMapAutocomplete"
	])
	.config(["$urlRouterProvider", "$stateProvider", function($urlRouterProvider, $stateProvider) {
		$urlRouterProvider.otherwise("/");

		$stateProvider
			.state("home",
				{
					url: "/",
					templateUrl: "app/components/home/homeView.html",
					controller: "HomeControl"
				});
		

	}]);