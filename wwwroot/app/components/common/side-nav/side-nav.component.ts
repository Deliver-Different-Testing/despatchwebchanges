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
    readonly userName?: string;
    readonly companyName: string = "DFRNT";
    readonly currentYear: number;
    readonly currentDate: string;

    navState = {
        isOpen: false,
        isAnimating: false
    };

    private timeoutId: angular.IPromise<void> | null = null;
    private readonly HOVER_DELAY = 300;
    private readonly ANIMATION_DURATION = 200;
    private sidenav?: JQuery;
    private sidenavService?: angular.material.ISidenavObject;
    private readonly debouncedToggle: (shouldOpen: boolean) => void;

    constructor(
        private $state: angular.ui.IStateService,
        private $mdSidenav: angular.material.ISidenavService,
        $timeout: angular.ITimeoutService,
        $interval: angular.IIntervalService,
        private $scope: angular.IScope,
        appConfig: AppConfig
    ) {
        super();
        this.initServices($timeout, $interval, this.$scope);

        this.isUsCustomer = appConfig.US_Customer;
        this.userName = FirstName;
        this.currentYear = dayjs().year();

        const locale = appConfig.US_Customer ? 'en' : 'en-nz';
        this.currentDate = dayjs().locale(locale).format('dddd, MMMM D, YYYY');

        this.sidenavService = this.$mdSidenav("right");

        this.debouncedToggle = this.debounce(this.toggleNav.bind(this), 50, 'navToggle');
    }

    $postLink(): void {
        this.sidenav = angular.element('md-sidenav');

        const handleMouseEnter = () => {
            this.cancelPendingTimeout();
            this.debouncedToggle(true);
        };

        const handleMouseLeave = () => {
            this.cancelPendingTimeout();
            this.timeoutId = this.registerTimeout(() => {
                this.debouncedToggle(false);
            }, this.HOVER_DELAY) as angular.IPromise<void>;
        };

        this.sidenav.on("mouseenter", handleMouseEnter);
        this.sidenav.on("mouseleave", handleMouseLeave);

        this.eventDeregistrations.push(() => {
            if (this.sidenav) {
                this.sidenav.off("mouseenter", handleMouseEnter);
                this.sidenav.off("mouseleave", handleMouseLeave);
            }
        });
    }

    isActive(stateName: string): boolean {
        return this.$state.current.name === stateName;
    }

    private cancelPendingTimeout(): void {
        if (this.timeoutId && this.$timeoutService) {
            this.$timeoutService.cancel(this.timeoutId);
            this.timeoutId = null;
        }
    }

    private toggleNav(shouldOpen: boolean): void {
        if (this.navState.isAnimating || shouldOpen === this.navState.isOpen) {
            return;
        }

        this.navState.isAnimating = true;

        this.$scope.$evalAsync(() => {
            if (!this.sidenavService) return;

            const action = shouldOpen ?
                this.sidenavService.open() :
                this.sidenavService.close();

            action
                .then(() => {
                    this.navState.isOpen = shouldOpen;

                    this.registerTimeout(() => {
                        this.navState.isAnimating = false;
                        this.$scope.$evalAsync();
                    }, this.ANIMATION_DURATION);
                })
                .catch((error) => {
                    console.warn('Sidenav toggle failed:', error);
                    this.navState.isAnimating = false;
                    this.$scope.$evalAsync();
                });
        });
    }

    $onDestroy(): void {
        this.cancelPendingTimeout();
        this.sidenavService = undefined;
        super.$onDestroy();
    }
}

export const MaterialSidenavComponent: angular.IComponentOptions = {
    template: require("./side-nav.template.html"),
    controller: MaterialSidenavComponentController,
    controllerAs: "ctrl"
};
