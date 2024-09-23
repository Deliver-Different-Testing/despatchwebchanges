angular.module('uDispatch')
    .directive('materialSidenav', ['materialSidenavService', 'versionUrl', 'APP_CONFIG', (materialSidenavService, versionUrl, APP_CONFIG) => ({
        restrict: 'E',
        templateUrl: versionUrl('app/components/common/side-nav/side-nav.template.html'),
        link: (scope, element, attrs) => {
            const cleanup = materialSidenavService.setupAutoClose(element);
            scope.materialSidenavService = materialSidenavService;

            // Settings
            scope.userName = FirstName;
            scope.companyName = 'DFRNT';
            scope.isUsCustomer = APP_CONFIG.US_Customer;

            // Clean up when the scope is destroyed
            scope.$on('$destroy', cleanup);
        }
    })]);
