angular.module('uDispatch')
    .directive('materialSidenav', ['$mdSidenav', '$timeout', '$state', 'versionUrl', 'APP_CONFIG',
        ($mdSidenav, $timeout, $state, versionUrl, APP_CONFIG) => ({
            restrict: 'E',
            templateUrl: versionUrl('app/components/common/side-nav/side-nav.html'),
            scope: true,
            controller: ['$scope', function ($scope) {
                $scope.isActive = stateName => $state.current.name === stateName;
            }],
            link: (scope, element, attrs) => {
                let timeoutId = null;

                scope.toggle = () => {
                    $mdSidenav('right').toggle();
                };

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

                // Settings
                scope.userName = FirstName;
                scope.companyName = 'DFRNT';
                scope.isUsCustomer = APP_CONFIG.US_Customer;

                scope.$on('$destroy', () => {
                    sidenav.off('mouseenter');
                    sidenav.off('mouseleave');
                });
            }
        })]);
