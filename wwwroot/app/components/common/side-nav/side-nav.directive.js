import app from "../../../app";
import "./side-nav.styles.less";

class MaterialSidenavController {
    static $inject = ["$scope", "$state"];

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
     * @returns {boolean}
     */
    isActive(stateName) {
        return this.$state.current.name === stateName;
    }
}

class SideNavDirective {
    static $inject = ["$mdSidenav", "$timeout", "APP_CONFIG"];

    constructor($mdSidenav, $timeout, APP_CONFIG) {
        this.$mdSidenav = $mdSidenav;
        this.$timeout = $timeout;
        this.APP_CONFIG = APP_CONFIG;

        this.restrict = "E";
        this.templateUrl = "app/components/common/side-nav/side-nav.template.html";
        this.scope = true;
        this.controller = MaterialSidenavController;
        this.controllerAs = "$ctrl";

        this.link = this.link.bind(this);
    }

    static factory() {
        const directive = ($mdSidenav, $timeout, APP_CONFIG) => {
            return new SideNavDirective($mdSidenav, $timeout, APP_CONFIG);
        };
        directive.$inject = ["$mdSidenav", "$timeout", "APP_CONFIG"];
        return directive;
    }

    link(scope, element) {
        let timeoutId = null;
        const HOVER_DELAY = 300;
        const ANIMATION_DURATION = 200;

        // Store the initial sidenav instance
        const sideNav = this.$mdSidenav("right");
        const sidenav = element.find("md-sidenav");

        /**
         * @param {boolean} shouldOpen
         */
        const toggleNav = (shouldOpen) => {
            if (scope.navState.isAnimating) return;
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

        sidenav.on("mouseenter", () => {
            if (timeoutId) {
                this.$timeout.cancel(timeoutId);
                timeoutId = null;
            }
            scope.$apply(() => toggleNav(true));
        });

        sidenav.on("mouseleave", () => {
            if (timeoutId) {
                this.$timeout.cancel(timeoutId);
            }
            timeoutId = this.$timeout(() => {
                scope.$apply(() => toggleNav(false));
            }, HOVER_DELAY);
        });

        scope.userName = FirstName;
        scope.companyName = "DFRNT";
        scope.isUsCustomer = this.APP_CONFIG.US_Customer;

        scope.$on("$destroy", () => {
            if (timeoutId) {
                this.$timeout.cancel(timeoutId);
            }
            sidenav.off("mouseenter");
            sidenav.off("mouseleave");
        });
    }
}

app.directive("materialSidenav", SideNavDirective.factory());
