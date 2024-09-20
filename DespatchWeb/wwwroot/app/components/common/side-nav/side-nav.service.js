class SidenavService {
    constructor($mdSidenav, $timeout) {
        this.$mdSidenav = $mdSidenav;
        this.$timeout = $timeout;
        this.timeoutId = null;
    }

    toggle() {
        this.$mdSidenav('right').toggle();
    }

    setupAutoClose(element) {
        const sidenav = element.find('md-sidenav');

        sidenav.on('mouseenter', () => {
            if (this.timeoutId) {
                this.$timeout.cancel(this.timeoutId);
            }
        });

        sidenav.on('mouseleave', () => {
            this.timeoutId = this.$timeout(() => {
                this.$mdSidenav('right').close();
            }, 300); // Adjust this delay as needed
        });

        return () => {
            // Return a cleanup function
            sidenav.off('mouseenter');
            sidenav.off('mouseleave');
        };
    }
}

angular.module('uDispatch')
    .service('materialSidenavService', ['$mdSidenav', '$timeout',
        ($mdSidenav, $timeout) => new SidenavService($mdSidenav, $timeout)
    ]);
