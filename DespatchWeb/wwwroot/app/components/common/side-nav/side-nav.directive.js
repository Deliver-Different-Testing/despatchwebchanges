angular.module('uDispatch')
    .directive('materialSidenav', ['materialSidenavService', materialSidenavService => ({
        restrict: 'E', template: `
            <md-sidenav class="md-sidenav-right" md-component-id="right">
                <md-toolbar>
                    <h1 class="md-toolbar-tools">
                        Despatch
                    </h1>                       
                </md-toolbar>
                <md-content>
                    <md-list>
                        <md-list-item class="selected" ui-sref="home" ui-sref-active="md-active">
                            <md-icon md-font-set="material-symbols-outlined">dashboard</md-icon>
                            <p>Dispatch</p>
                        </md-list-item>
                        <md-list-item ui-sref="nw" ui-sref-active="md-active">
                            <md-icon md-font-set="material-symbols-outlined">public</md-icon>
                            <p>Domestic</p>
                        </md-list-item>
                        <md-list-item ui-sref="cs" ui-sref-active="md-active">
                            <md-icon md-font-set="material-symbols-outlined">search</md-icon>
                            <p>Job Search</p>
                        </md-list-item>
                        <md-list-item ui-sref="prebooks" ui-sref-active="md-active">
                            <md-icon md-font-set="material-symbols-outlined">book</md-icon>
                            <p>PreBooks</p>
                        </md-list-item>
                    </md-list>
                </md-content>
            </md-sidenav>
        `, link: (scope, element, attrs) => {
            const cleanup = materialSidenavService.setupAutoClose(element);

            // Clean up when the scope is destroyed
            scope.$on('$destroy', cleanup);
        }
    })]);
