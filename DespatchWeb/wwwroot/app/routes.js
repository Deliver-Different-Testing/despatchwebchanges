/**
 * @fileoverview Angular routing configuration for uDispatch module
 * @module uDispatch
 */
angular.module('uDispatch')
    /**
     * Configuration function for Angular routing
     * @param {Object} $urlRouterProvider - The URL router provider
     * @param {Object} $stateProvider - The state provider for UI-Router
     * @param {Object} versionUrlProvider - Custom provider for versioned URLs
     */
    .config(['$urlRouterProvider', '$stateProvider', 'versionUrlProvider',
        ($urlRouterProvider, $stateProvider, versionUrlProvider) => {
            const versionUrl = versionUrlProvider.$get();

            // Set default route
            $urlRouterProvider.otherwise('/');

            /**
             * Configure application states/routes
             */
            $stateProvider
                /**
                 * Home
                 * @property {string} url - The URL for this state
                 * @property {string} templateUrl - The URL for the template file
                 * @property {string} controller - The controller for this state
                 */
                .state('home', {
                    url: '/?jobId',
                    templateUrl: versionUrl('app/components/home/homeView.html'),
                    controller: 'HomeControl',
                    params: {
                        jobId: {
                            value: null,
                            squash: true
                        }
                    }
                })
                /**
                 * Nationwide
                 * @property {string} url - The URL for this state
                 * @property {string} templateUrl - The URL for the template file
                 * @property {string} controller - The controller for this state
                 * @property {boolean} reloadOnSearch - Whether to reload the state on search change
                 */
                .state('nw', {
                    url: '/Nationwide',
                    templateUrl: versionUrl('app/components/Nationwide/nationwideView.html'),
                    controller: 'NationwideControl',
                    reloadOnSearch: false
                })
                /**
                 * CS
                 * @property {string} url - The URL for this state
                 * @property {string} templateUrl - The URL for the template file
                 * @property {string} controller - The controller for this state
                 * @property {boolean} reloadOnSearch - Whether to reload the state on search change
                 */
                .state('cs', {
                    url: '/CS',
                    templateUrl: versionUrl('app/components/CS/csView.html'),
                    controller: 'CSControl',
                    reloadOnSearch: false
                })
                /**
                 * Prebooks
                 * @property {string} url - The URL for this state
                 * @property {string} templateUrl - The URL for the template file
                 * @property {string} controller - The controller for this state
                 * @property {boolean} reloadOnSearch - Whether to reload the state on search change
                 */
                .state('prebooks', {
                    url: '/prebooks',
                    templateUrl: versionUrl('app/components/prebooks/prebookView.html'),
                    controller: 'PBControl',
                    reloadOnSearch: false
                })
                /**
                 * Overview
                 * @property {string} url - The URL for this state
                 * @property {string} templateUrl - The URL for the template file
                 * @property {string} controller - The controller for this state
                 * @property {boolean} reloadOnSearch - Whether to reload the state on search change
                 */
                .state('overview', {
                    url: '/overview',
                    templateUrl: versionUrl('app/components/overview/overview.template.html'),
                    controller: 'deliveryOverview',
                    controllerAs: 'ctrl',
                    reloadOnSearch: false,
                })
                /**
                 * MegaMap
                 * @property {string} url - The URL for this state
                 * @property {string} templateUrl - The URL for the template file
                 * @property {string} controller - The controller for this state
                 * @property {boolean} reloadOnSearch - Whether to reload the state on search change
                 */
                .state('megaMap', {
                    url: '/megaMap',
                    templateUrl: versionUrl('app/components/overview/mega-map/mega-map.template.html'),
                    controller: 'megaMapController',
                    controllerAs: 'ctrl',
                    reloadOnSearch: false,
                });
        }]);
