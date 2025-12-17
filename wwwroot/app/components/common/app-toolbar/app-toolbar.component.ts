import "./app-toolbar.styles.less";
import NavigationService from "../../../services/navigation.service";
import greetUser from "../../../functions/greetUser";
import {FirstName} from "../../../contants";

class AppToolbarController {
    static $inject = [
        '$mdSidenav',
        'navigationService',
    ];

    title: string = '';
    greeting: string;

    constructor(
        private $mdSidenav: angular.material.ISidenavService,
        private navigationService: NavigationService,
    ) {
        this.greeting = greetUser(FirstName);
    }

    async openHubUrl(): Promise<void> {
        await this.navigationService.openHubUrl();
    }

    toggleSidenav(): void {
        const sidenavElement = angular.element('material-sidenav');
        const sidenavCtrl = sidenavElement.controller('materialSidenav');

        if (sidenavCtrl && typeof sidenavCtrl.toggleSidenav === 'function') {
            sidenavCtrl.toggleSidenav();
        } else {
            this.$mdSidenav('right').toggle();
        }
    }
}

const AppToolbarComponent: angular.IComponentOptions = {
    template: require("./app-toolbar.template.html"),
    bindings: {
        title: '@',
    },
    transclude: true,
    controller: AppToolbarController,
    controllerAs: "ctrl"
};

export default AppToolbarComponent;
