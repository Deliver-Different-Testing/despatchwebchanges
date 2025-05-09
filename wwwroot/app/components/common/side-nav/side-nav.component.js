"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MaterialSidenavComponent = void 0;
require("./side-nav.styles.less");
const bindAllMethods_1 = require("../../../bindAllMethods");
class MaterialSidenavComponentController {
    constructor($state, $mdSidenav, $timeout, APP_CONFIG) {
        this.$state = $state;
        this.$mdSidenav = $mdSidenav;
        this.$timeout = $timeout;
        this.navState = {
            isOpen: false,
            isAnimating: false
        };
        this.companyName = "DFRNT";
        this.timeoutId = null;
        this.HOVER_DELAY = 300;
        this.ANIMATION_DURATION = 200;
        bindAllMethods_1.bindAllMethods(this);
        this.isUsCustomer = APP_CONFIG.US_Customer;
        this.userName = FirstName;
        this.currentYear = new Date().getFullYear();
        // Format the date
        const today = new Date();
        const options = {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        };
        const locale = APP_CONFIG.US_Customer ? 'en-US' : 'en-NZ';
        this.currentDate = today.toLocaleDateString(locale, options);
    }
    $postLink() {
        // Store the sidenav element after DOM is ready
        this.sidenav = angular.element('md-sidenav');
        // Set up event listeners
        this.sidenav.on("mouseenter", () => {
            if (this.timeoutId) {
                this.$timeout.cancel(this.timeoutId);
                this.timeoutId = null;
            }
            this.toggleNav(true);
        });
        this.sidenav.on("mouseleave", () => {
            if (this.timeoutId) {
                this.$timeout.cancel(this.timeoutId);
            }
            this.timeoutId = this.$timeout(() => {
                this.toggleNav(false);
            }, this.HOVER_DELAY);
        });
    }
    $onDestroy() {
        if (this.timeoutId) {
            this.$timeout.cancel(this.timeoutId);
        }
        if (this.sidenav) {
            this.sidenav.off("mouseenter");
            this.sidenav.off("mouseleave");
        }
    }
    isActive(stateName) {
        return this.$state.current.name === stateName;
    }
    toggleNav(shouldOpen) {
        if (this.navState.isAnimating)
            return;
        if (shouldOpen === this.navState.isOpen)
            return;
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
MaterialSidenavComponentController.$inject = ["$state", "$mdSidenav", "$timeout", "APP_CONFIG"];
exports.MaterialSidenavComponent = {
    template: require("./side-nav.template.html"),
    controller: MaterialSidenavComponentController,
    controllerAs: "ctrl"
};
