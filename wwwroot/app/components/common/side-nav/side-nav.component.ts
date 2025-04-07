import {AppConfig} from "../../../interfaces/app-config.interface";
import "./side-nav.styles.less";
import BaseController from "../../base-controller";

class MaterialSidenavComponentController extends BaseController {
    static $inject = [
        "$state",
        "$mdSidenav",
        "$timeout",
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
        private $timeout: angular.ITimeoutService,
        APP_CONFIG: AppConfig
    ) {
        super();
        this.isUsCustomer = APP_CONFIG.US_Customer;
        this.userName = FirstName;
        this.currentYear = new Date().getFullYear();

        // Format the date
        const today = new Date();
        const options: Intl.DateTimeFormatOptions = {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        };

        const locale = APP_CONFIG.US_Customer ? 'en-US' : 'en-NZ';
        this.currentDate = today.toLocaleDateString(locale, options);
    }

    $postLink(): void {
        this.sidenav = angular.element('md-sidenav');

        // Set up event listeners
        this.sidenav.on("mouseenter", () => {
            if (this.timeoutId) {
                this.$timeout.cancel(this.timeoutId);
                this.timeoutId = null;
            }

            this._toggleNav(true);
        });

        this.sidenav.on("mouseleave", () => {
            if (this.timeoutId) {
                this.$timeout.cancel(this.timeoutId);
            }

            this.timeoutId = this.$timeout(() => {
                this._toggleNav(false);
            }, this.HOVER_DELAY);
        });
    }

    $onDestroy(): void {
        if (this.timeoutId) {
            this.$timeout.cancel(this.timeoutId);
        }

        if (this.sidenav) {
            this.sidenav.off("mouseenter");
            this.sidenav.off("mouseleave");
        }
    }

    isActive(stateName: string): boolean {
        return this.$state.current.name === stateName;
    }

    private _toggleNav(shouldOpen: boolean): void {
        if (this.navState.isAnimating) return;
        if (shouldOpen === this.navState.isOpen) return;

        this.navState.isAnimating = true;

        const sideNav = this.$mdSidenav("right");
        const action = shouldOpen ? sideNav.open() : sideNav.close();
        action.then(() => {
            this.navState.isOpen = shouldOpen;
            this.$timeout(() => {
                this.navState.isAnimating = false;
            }, this.ANIMATION_DURATION);
        });
    }
}

export const MaterialSidenavComponent: angular.IComponentOptions = {
    template: require("./side-nav.template.html"),
    controller: MaterialSidenavComponentController,
    controllerAs: "ctrl"
};
