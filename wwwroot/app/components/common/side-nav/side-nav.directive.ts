import app from "../../../app";
import "./side-nav.styles.less";
import angular from "angular";
import {SideNavScope} from "./side-nav.interfaces";
import {AppConfig} from "../../../interfaces/app-config.interface";

class MaterialSidenavController implements angular.IController {
    static $inject = ["$scope", "$state"];

    constructor(private $scope: SideNavScope,
                private $state: angular.ui.IStateService) {
        this.$scope.isActive = this.isActive.bind(this);
        this.$scope.navState = {
            isOpen: false,
            isAnimating: false
        };
    }

    public isActive(stateName: string): boolean {
        return this.$state.current.name === stateName;
    }
}

class SideNavDirective implements angular.IDirective {
    static $inject = ["$mdSidenav", "$timeout", "APP_CONFIG"];
    restrict: 'E';
    templateUrl: string;
    scope: boolean;
    controller: typeof MaterialSidenavController;
    controllerAs: string;

    constructor(private $mdSidenav: angular.material.ISidenavService,
                private $timeout: angular.ITimeoutService,
                private APP_CONFIG: AppConfig) {
        this.restrict = "E";
        this.templateUrl = "app/components/common/side-nav/side-nav.template.html";
        this.scope = true;
        this.controller = MaterialSidenavController;
        this.controllerAs = "$ctrl";

        this.link = this.link.bind(this);
    }

    static factory(): any {
        const directive = ($mdSidenav: angular.material.ISidenavService,
                           $timeout: angular.ITimeoutService, APP_CONFIG: AppConfig) => {
            return new SideNavDirective($mdSidenav, $timeout, APP_CONFIG);
        };
        directive.$inject = ["$mdSidenav", "$timeout", "APP_CONFIG"];
        return directive;
    }

    link(scope: angular.IScope, element: angular.IAugmentedJQuery): void {
        const $scope = scope as SideNavScope;
        let timeoutId: angular.IPromise<void> | null = null;
        const HOVER_DELAY = 300;
        const ANIMATION_DURATION = 200;

        // Store the initial sidenav instance
        const sideNav = this.$mdSidenav("right");
        const sidenav = element.find("md-sidenav");

        const toggleNav = (shouldOpen: boolean) => {
            if ($scope.navState.isAnimating) return;
            if (shouldOpen === $scope.navState.isOpen) return;

            $scope.navState.isAnimating = true;

            const action = shouldOpen ? sideNav.open() : sideNav.close();
            action.then(() => {
                $scope.navState.isOpen = shouldOpen;
                this.$timeout(() => {
                    $scope.navState.isAnimating = false;
                }, ANIMATION_DURATION);
            });
        };

        sidenav.on("mouseenter", () => {
            if (timeoutId) {
                this.$timeout.cancel(timeoutId);
                timeoutId = null;
            }
            $scope.$apply(() => toggleNav(true));
        });

        sidenav.on("mouseleave", () => {
            if (timeoutId) {
                this.$timeout.cancel(timeoutId);
            }
            timeoutId = this.$timeout(() => {
                $scope.$apply(() => toggleNav(false));
            }, HOVER_DELAY);
        });

        $scope.userName = FirstName;
        $scope.companyName = "DFRNT";
        $scope.isUsCustomer = this.APP_CONFIG.US_Customer;

        $scope.$on("$destroy", () => {
            if (timeoutId) {
                this.$timeout.cancel(timeoutId);
            }
            sidenav.off("mouseenter");
            sidenav.off("mouseleave");
        });
    }
}

app.directive("materialSidenav", SideNavDirective.factory());
