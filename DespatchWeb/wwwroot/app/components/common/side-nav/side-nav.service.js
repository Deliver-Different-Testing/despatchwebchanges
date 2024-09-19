// sidenavService.js

class SidenavService {
    constructor($mdSidenav) {
        this.$mdSidenav = $mdSidenav;
    }

    toggleLeft() {
        this.$mdSidenav('left').toggle();
    }
}

angular.module('uDispatch')
    .service('materialSidenavService', ['$mdSidenav', $mdSidenav => new SidenavService($mdSidenav)]);
