angular.module('uDispatch')
    .directive('materialSidenav', ['$mdSidenav', '$timeout', '$state', 'versionUrl', 'APP_CONFIG',
        ($mdSidenav, $timeout, $state, versionUrl, APP_CONFIG) => ({
            restrict: 'E',
            templateUrl: versionUrl('app/components/common/side-nav/side-nav.template.html'),
            scope: true,
            controller: ['$scope', ($scope) => {
                $scope.isActive = (stateName) => $state.current.name === stateName;

                $scope.navState = {
                    isOpen: false,
                    isAnimating: false
                };
            }],
            link: (scope, element, attrs) => {
                let timeoutId = null;
                const HOVER_DELAY = 300;
                const ANIMATION_DURATION = 200;

                // Store the initial sidenav instance
                const sideNav = $mdSidenav('right');
                const sidenav = element.find('md-sidenav');

                // Single toggle function that manages all state
                const toggleNav = (shouldOpen) => {
                    if (scope.navState.isAnimating) return;

                    // If the nav is already in the desired state, do nothing
                    if (shouldOpen === scope.navState.isOpen) return;

                    scope.navState.isAnimating = true;

                    const action = shouldOpen ? sideNav.open() : sideNav.close();
                    action.then(() => {
                        scope.navState.isOpen = shouldOpen;
                        $timeout(() => {
                            scope.navState.isAnimating = false;
                        }, ANIMATION_DURATION);
                    });
                };

                // Simplified mouseenter handler
                sidenav.on('mouseenter', () => {
                    if (timeoutId) {
                        $timeout.cancel(timeoutId);
                        timeoutId = null;
                    }

                    scope.$apply(() => toggleNav(true));
                });

                // Simplified mouseleave handler
                sidenav.on('mouseleave', () => {
                    if (timeoutId) {
                        $timeout.cancel(timeoutId);
                    }

                    timeoutId = $timeout(() => {
                        scope.$apply(() => toggleNav(false));
                    }, HOVER_DELAY);
                });

                // User settings
                scope.userName = FirstName;
                scope.companyName = 'DFRNT';
                scope.isUsCustomer = APP_CONFIG.US_Customer;

                // Cleanup
                scope.$on('$destroy', () => {
                    if (timeoutId) {
                        $timeout.cancel(timeoutId);
                    }
                    sidenav.off('mouseenter');
                    sidenav.off('mouseleave');
                });
            }
        })]);
