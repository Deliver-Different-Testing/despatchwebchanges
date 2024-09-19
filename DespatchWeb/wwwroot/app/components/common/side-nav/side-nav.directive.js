// sidenavDirective.js

angular.module('uDispatch')
    .directive('materialSidenav', ['materialSidenavService', materialSidenavService => ({
        restrict: 'E',
        template: `
                <md-sidenav class="md-sidenav-left" md-component-id="left">
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
            `,
        link: (scope, element, attrs) => {
            // You can add any additional functionality here if needed
        }
    })]);
