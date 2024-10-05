angular.module('uDispatch')
    .directive('materialSidenav', ['$mdSidenav', '$timeout', '$rootScope', 'versionUrl', 'APP_CONFIG',
        ($mdSidenav, $timeout, $rootScope, versionUrl, APP_CONFIG) => ({
            restrict: 'E',
            templateUrl: versionUrl('app/components/common/side-nav/side-nav.html'),
            link: (scope, element, attrs) => {
                let timeoutId = null;
                let currentState = '';

                // Listen for state changes
                $rootScope.$on('$stateChangeSuccess', (event, toState) => {
                    currentState = toState.name;
                });

                // Toggle function
                scope.toggle = () => {
                    $mdSidenav('right').toggle();
                };

                // Setup auto close
                const sidenav = element.find('md-sidenav');

                sidenav.on('mouseenter', () => {
                    if (timeoutId) {
                        $timeout.cancel(timeoutId);
                    }
                });

                sidenav.on('mouseleave', () => {
                    timeoutId = $timeout(() => {
                        $mdSidenav('right').close();
                    }, 300);
                });

                // Is active function
                scope.isActive = stateName => currentState === stateName;

                // Settings
                scope.userName = FirstName;
                scope.companyName = 'DFRNT';
                scope.isUsCustomer = APP_CONFIG.US_Customer;

                // Clean up when the scope is destroyed
                scope.$on('$destroy', () => {
                    sidenav.off('mouseenter');
                    sidenav.off('mouseleave');
                });
            }
        })]);
