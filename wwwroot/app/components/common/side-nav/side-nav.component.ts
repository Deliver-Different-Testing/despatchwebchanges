import {AppConfig} from "../../../interfaces/app-config.interface";
import "./side-nav.styles.less";
import BaseController from "../../base-controller";
import dayjs from "dayjs";

class MaterialSidenavComponentController extends BaseController {
    static $inject = [
        "$state",
        "$mdSidenav",
        "$timeout",
        "$interval",
        "$scope",
        "APP_CONFIG"
    ];

    readonly isUsCustomer: boolean;
    navState = {
        isOpen: false,
        isAnimating: false
    };
    userName?: string;
    companyName: string = "DFRNT";
    currentYear: number;
    currentDate: string;

    private timeoutId: angular.IPromise<void> | null = null;
    private readonly HOVER_DELAY = 300;
    private readonly ANIMATION_DURATION = 200;
    private sidenav?: JQuery;

    constructor(
        private $state: angular.ui.IStateService,
        private $mdSidenav: angular.material.ISidenavService,
        $timeout: angular.ITimeoutService,
        $interval: angular.IIntervalService,
        private $scope: angular.IScope,
        appConfig: AppConfig
    ) {
        super();
        this.initServices($timeout, $interval);

        this.isUsCustomer = appConfig.US_Customer;
        this.userName = FirstName;
        this.currentYear = dayjs().year();

        // Format the date
        const locale = appConfig.US_Customer ? 'en' : 'en-nz';
        this.currentDate = dayjs().locale(locale).format('dddd, MMMM D, YYYY');
    }

    $postLink(): void {
        this.sidenav = angular.element('md-sidenav');

        this.sidenav.on("mouseenter", () => {
            if (this.timeoutId) {
                if (this.$timeoutService) {
                    this.$timeoutService.cancel(this.timeoutId);
                }

                this.timeoutId = null;
            }

            this.toggleNav(true);
        });

        this.sidenav.on("mouseleave", () => {
            if (this.timeoutId) {
                if (this.$timeoutService) {
                    this.$timeoutService.cancel(this.timeoutId);
                }
            }

            this.timeoutId = this.registerTimeout(() => {
                this.toggleNav(false);
            }, this.HOVER_DELAY) as angular.IPromise<void>;
        });

        this.eventDeregistrations.push(() => {
            if (this.sidenav) {
                this.sidenav.off("mouseenter");
                this.sidenav.off("mouseleave");
            }
        });
    }

    isActive(stateName: string): boolean {
        return this.$state.current.name === stateName;
    }

    private toggleNav(shouldOpen: boolean): void {
        if (this.navState.isAnimating) return;
        if (shouldOpen === this.navState.isOpen) return;

        this.navState.isAnimating = true;

        this.$scope.$apply();

        const sideNav = this.$mdSidenav("right");
        const action = shouldOpen ? sideNav.open() : sideNav.close();

        action.then(() => {
            this.navState.isOpen = shouldOpen;

            this.registerTimeout(() => this.$scope.$apply());

            this.registerTimeout(() => {
                this.navState.isAnimating = false;
            }, this.ANIMATION_DURATION);
        }).catch(() => {
            this.navState.isAnimating = false;
        }).finally(() => {
            this.registerTimeout(() => this.$scope.$apply());
        });
    }
}

export const MaterialSidenavComponent: angular.IComponentOptions = {
    template: require("./side-nav.template.html"),
    controller: MaterialSidenavComponentController,
    controllerAs: "ctrl"
};
