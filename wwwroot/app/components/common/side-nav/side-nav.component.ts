import {IAppConfig} from "../../../interfaces/app-config.interface";
import "./side-nav.styles.less";
import BaseController from "../../base-controller";
import dayjs from "dayjs";
import {FullName} from "../../../contants";
import INavState from "./interfaces/INavState";

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

    // Navigation state
    navState: INavState = {
        isOpen: false,
        isAnimating: false
    };

    // Configuration constants
    private readonly HOVER_DELAY = 300;
    private readonly ANIMATION_DURATION = 200;
    private readonly DEBOUNCE_DELAY = 50;

    // Services and DOM references
    private sidenavService?: angular.material.ISidenavObject;
    private sidenavElement?: JQuery;

    // Debounced methods
    private readonly debouncedOpen: () => void;
    private readonly debouncedClose: () => void;

    constructor(
        private $state: angular.ui.IStateService,
        private $mdSidenav: angular.material.ISidenavService,
        $timeout: angular.ITimeoutService,
        $interval: angular.IIntervalService,
        $scope: angular.IScope,
        appConfig: IAppConfig
    ) {
        super();
        this.initServices($timeout, $interval, $scope);

        // Initialize read-only properties
        this.isUsCustomer = appConfig.US_Customer;
        this.userName = FullName;
        this.currentYear = dayjs().year();

        const locale = appConfig.US_Customer ? 'en' : 'en-nz';
        this.currentDate = dayjs().locale(locale).format('dddd, MMMM D, YYYY');

        this.debouncedOpen = this.debounce(
            this.openSidenav.bind(this),
            this.DEBOUNCE_DELAY,
            'sidenavOpen'
        );
        this.debouncedClose = this.debounce(
            this.closeSidenav.bind(this),
            this.DEBOUNCE_DELAY,
            'sidenavClose'
        );
    }

    $postLink(): void {
        this.registerTimeout(() => {
            this.initializeSidenav();
        });
    }

    private initializeSidenav(): void {
        try {
            // Get sidenav service
            this.sidenavService = this.$mdSidenav("right");

            // Cache DOM element
            this.sidenavElement = angular.element('md-sidenav[md-component-id="right"]');

            if (this.sidenavElement.length) {
                this.setupEventListeners();
                console.info('Sidenav initialized successfully');
            } else {
                console.warn('Sidenav element not found');
                this.registerTimeout(() => this.initializeSidenav(), 100);
            }
        } catch (error) {
            console.error('Failed to initialize sidenav:', error);
            this.registerTimeout(() => this.initializeSidenav(), 200);
        }
    }

    private setupEventListeners(): void {
        if (!this.sidenavElement) return;

        const handleMouseEnter = () => {
            if (!this.navState.isAnimating && !this.navState.isOpen) {
                this.debouncedOpen();
            }
        };

        const handleMouseLeave = () => {
            if (!this.navState.isAnimating && this.navState.isOpen) {
                this.registerTimeout(() => {
                    if (!this.navState.isAnimating && this.navState.isOpen) {
                        this.debouncedClose();
                    }
                }, this.HOVER_DELAY);
            }
        };

        // Bind events using jQuery and register cleanup
        this.sidenavElement.on("mouseenter", handleMouseEnter);
        this.sidenavElement.on("mouseleave", handleMouseLeave);

        // Register cleanup using BaseController's event system
        this.eventDeregistrations.push(() => {
            if (this.sidenavElement) {
                this.sidenavElement.off("mouseenter", handleMouseEnter);
                this.sidenavElement.off("mouseleave", handleMouseLeave);
            }
        });
    }

    private openSidenav(): void {
        if (!this.sidenavService || this.navState.isAnimating || this.navState.isOpen) {
            return;
        }

        this.performSidenavAction(true, () => this.sidenavService!.open());
    }

    private closeSidenav(): void {
        if (!this.sidenavService || this.navState.isAnimating || !this.navState.isOpen) {
            return;
        }

        this.performSidenavAction(false, () => this.sidenavService!.close());
    }

    private performSidenavAction(targetState: boolean, action: () => angular.IPromise<void>): void {
        this.navState.isAnimating = true;

        this.applyScope();

        action()
            .then(() => {
                this.navState.isOpen = targetState;

                this.registerTimeout(() => {
                    this.navState.isAnimating = false;
                    this.applyScope();
                }, this.ANIMATION_DURATION);
            })
            .catch((error) => {
                console.error('Sidenav action failed:', error);
                this.navState.isAnimating = false;
                this.applyScope();
            });
    }

    isActive(stateName: string): boolean {
        return this.$state.current.name === stateName;
    }

    $onDestroy(): void {
        // Clear references
        this.sidenavService = undefined;
        this.sidenavElement = undefined;

        // Call parent cleanup
        super.$onDestroy();
    }
}

export const MaterialSidenavComponent: angular.IComponentOptions = {
    template: require("./side-nav.template.html"),
    controller: MaterialSidenavComponentController,
    controllerAs: "ctrl"
};