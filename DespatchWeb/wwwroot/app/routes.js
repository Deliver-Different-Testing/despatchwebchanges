// Moved routes to own file for clear code and so it will load after version
angular.module('uDispatch')
    .config(['$urlRouterProvider', '$stateProvider', 'versionUrlProvider',
        ($urlRouterProvider, $stateProvider, versionUrlProvider) => {
            const versionUrl = versionUrlProvider.$get();

            $urlRouterProvider.otherwise('/');

            $stateProvider
                .state('home', {
                    url: '/',
                    templateUrl: versionUrl('app/components/home/homeView.html'),
                    controller: 'HomeControl'
                })
                .state('nw', {
                    url: '/Nationwide',
                    templateUrl: versionUrl('app/components/Nationwide/nationwideView.html'),
                    controller: 'NationwideControl',
                    reloadOnSearch: false
                })
                .state('cs', {
                    url: '/CS',
                    templateUrl: versionUrl('app/components/CS/csView.html'),
                    controller: 'CSControl',
                    reloadOnSearch: false
                })
                .state('prebooks', {
                    url: '/prebooks',
                    templateUrl: versionUrl('app/components/prebooks/prebookView.html'),
                    controller: 'PBControl',
                    reloadOnSearch: false
                });
        }]);
