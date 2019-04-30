angular
	.module('udispatch', [
		'ui.router',
		'ct.ui.router.extras',
		'angularResizable',
		'ui.sortable',
		'ui.bootstrap.contextMenu', 
		'cfp.hotkeys',
		'ui.timepicker',
		'ngMapAutocomplete'
	])
	.config(['$urlRouterProvider', '$stateProvider', function($urlRouterProvider, $stateProvider) {
		$urlRouterProvider.otherwise('/');

		$stateProvider
			.state('home', {
				url: '/',
				templateUrl: 'app/components/home/homeView.html',
				controller: 'HomeControl'
			})
			/*
			.state('new', {
				url: '/',
				templateUrl: 'app/components/new/newView.html',
				controller: 'NewCtrl'
			})
			
			.state('search', {
				url: '/search/:query',
				controller: 'SearchCtrl',
				templateUrl: 'app/components/search/searchView.html',
				params: { 
		            // here we define default value for foo
		            // we also set squash to false, to force injecting
		            // even the default value into url
		            screen: {
		            	value: "current",
		            	squash: false
		            }
		        }
			})
			*/

	}])