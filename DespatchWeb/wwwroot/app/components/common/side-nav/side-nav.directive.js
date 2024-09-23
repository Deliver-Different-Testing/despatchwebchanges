// sidenavDirective.js

angular.module('uDispatch')
    .directive('materialSidenav', ['materialSidenavService', 'versionUrl', (materialSidenavService, versionUrl) => ({
        restrict: 'E',
        templateUrl: versionUrl('app/components/common/side-nav/side-nav.template.html'),
        link: (scope, element, attrs) => {
            const cleanup = materialSidenavService.setupAutoClose(element);

            // Make the service available in the scope
            scope.materialSidenavService = materialSidenavService;
            scope.userName = FirstName;
            scope.companyName = 'DFRNT';

            // Clean up when the scope is destroyed
            scope.$on('$destroy', cleanup);
        }
    })]);
