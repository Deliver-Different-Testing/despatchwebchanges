class SidenavService {
    constructor($mdSidenav, $timeout, $rootScope) {
        this._$mdSidenav = $mdSidenav;
        this._$timeout = $timeout;
        this.timeoutId = null;
        this.currentState = '';

        // Listen for state changes
        $rootScope.$on('$stateChangeSuccess', (event, toState) => {
            this.currentState = toState.name;
        });
    }

    toggle() {
        this._$mdSidenav('right').toggle();
    }

    setupAutoClose(element) {
        const sidenav = element.find('md-sidenav');

        sidenav.on('mouseenter', () => {
            if (this.timeoutId) {
                this._$timeout.cancel(this.timeoutId);
            }
        });

        sidenav.on('mouseleave', () => {
            this.timeoutId = this._$timeout(() => {
                this._$mdSidenav('right').close();
            }, 300);
        });

        return () => {
            // Return a cleanup function
            sidenav.off('mouseenter');
            sidenav.off('mouseleave');
        };
    }

    isActive(stateName) {
        return this.currentState === stateName;
    }
}

angular.module('uDispatch')
    .service('materialSidenavService', ['$mdSidenav', '$timeout', '$rootScope',
        ($mdSidenav, $timeout, $rootScope) => new SidenavService($mdSidenav, $timeout, $rootScope)
    ]);
