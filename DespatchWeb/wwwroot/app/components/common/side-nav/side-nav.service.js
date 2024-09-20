// sidenavService.js

class SidenavService {
    constructor($mdSidenav) {
        this.$mdSidenav = $mdSidenav;
    }

    toggle() {
        this.$mdSidenav('right').toggle();
    }
}

angular.module('uDispatch')
    .service('materialSidenavService', ['$mdSidenav', $mdSidenav => new SidenavService($mdSidenav)]);
