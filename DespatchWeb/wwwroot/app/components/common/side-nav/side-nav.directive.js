class MaterialSidenavController {
    static $inject = ['$scope', '$state'];

    constructor($scope, $state) {
        this.$scope = $scope;
        this.$state = $state;

        // Initialize scope methods
        this.$scope.isActive = this.isActive.bind(this);

        // Initialize scope properties
        this.$scope.navState = {
            isOpen: false,
            isAnimating: false
        };
    }

    /**
     * @param {string} stateName
     */
    isActive(stateName) {
        return this.$state.current.name === stateName;
    }
}

class MaterialSidenavDirective {
    static $inject = [
        '$mdSidenav',
        '$timeout',
        '$state',
        'versionUrl',
        'APP_CONFIG'
    ];

    constructor($mdSidenav, $timeout, $state, versionUrl, APP_CONFIG) {
        this.$mdSidenav = $mdSidenav;
        this.$timeout = $timeout;
        this.$state = $state;
        this.versionUrl = versionUrl;
        this.APP_CONFIG = APP_CONFIG;

        // Define directive configuration
        this.restrict = 'E';
        this.templateUrl = versionUrl('app/components/common/side-nav/side-nav.template.html');
        this.scope = true;
        this.controller = MaterialSidenavController;
    }

    // Factory method to create the directive
    static directiveFactory($mdSidenav, $timeout, $state, versionUrl, APP_CONFIG) {
        const directive = new MaterialSidenavDirective($mdSidenav, $timeout, $state, versionUrl, APP_CONFIG);
        return {
            restrict: directive.restrict,
            templateUrl: directive.templateUrl,
            scope: directive.scope,
            controller: directive.controller,
            link: directive.link.bind(directive)
        };
    }

    link(scope, element, attrs) {
        let timeoutId = null;
        const HOVER_DELAY = 300;
        const ANIMATION_DURATION = 200;

        // Store the initial sidenav instance
        const sideNav = this.$mdSidenav('right');
        const sidenav = element.find('md-sidenav');

        /**
         * @param {boolean} shouldOpen
         */
        const toggleNav = (shouldOpen) => {
            if (scope.navState.isAnimating) return;

            // If the nav is already in the desired state, do nothing
            if (shouldOpen === scope.navState.isOpen) return;

            scope.navState.isAnimating = true;

            const action = shouldOpen ? sideNav.open() : sideNav.close();
            action.then(() => {
                scope.navState.isOpen = shouldOpen;
                this.$timeout(() => {
                    scope.navState.isAnimating = false;
                }, ANIMATION_DURATION);
            });
        };

        // Simplified mouseenter handler
        sidenav.on('mouseenter', () => {
            if (timeoutId) {
                this.$timeout.cancel(timeoutId);
                timeoutId = null;
            }

            scope.$apply(() => toggleNav(true));
        });

        // Simplified mouseleave handler
        sidenav.on('mouseleave', () => {
            if (timeoutId) {
                this.$timeout.cancel(timeoutId);
            }

            timeoutId = this.$timeout(() => {
                scope.$apply(() => toggleNav(false));
            }, HOVER_DELAY);
        });

        // User settings
        scope.userName = FirstName;
        scope.companyName = 'DFRNT';
        scope.isUsCustomer = this.APP_CONFIG.US_Customer;

        // Cleanup
        scope.$on('$destroy', () => {
            if (timeoutId) {
                this.$timeout.cancel(timeoutId);
            }
            sidenav.off('mouseenter');
            sidenav.off('mouseleave');
        });
    }
}

// Register the directive
angular.module('uDispatch')
    .directive('materialSidenav', MaterialSidenavDirective.directiveFactory);
