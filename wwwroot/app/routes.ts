class RouterConfig {
    constructor(
        private $urlRouterProvider: angular.ui.IUrlRouterProvider,
        private $stateProvider: angular.ui.IStateProvider
    ) {
        this.configureRoutes();
    }

    private configureRoutes(): void {
            this.$urlRouterProvider.otherwise("/");
            
            // Configure routes
            this.configureHomeState()
                .configureNationwideState()
                .configureCSState()
                .configureJobSearchState()
                .configurePrebooksState()
                .configureOverviewState()
                .configureMegaMapState()
                .configureTaskDashboardState();
        }

    private configureHomeState(): this {
        this.$stateProvider.state("home", {
            url: "/?jobId",
            params: {
                jobId: {
                    value: null,
                    squash: true
                }
            },
            resolve: {
                jobId: ['$stateParams', ($stateParams: any) => {
                    return $stateParams.jobId ? parseInt($stateParams.jobId, 10) : null;
                }],
                loadModule: ['$ocLazyLoad', ($ocLazyLoad: oc.ILazyLoad) => {
                    return $ocLazyLoad.load([
                        'dist/home.js',
                        'dist/home.css'
                    ]);
                }]
            },
            component: "homeComponent"
        });
        return this;
    }

    private configureNationwideState(): this {
        this.$stateProvider.state("nw", {
            url: "/Nationwide?jobId",
            template: '<nationwide-component></nationwide-component>',
            params: {
                jobId: {
                    value: null,
                    squash: true
                }
            },
            resolve: {
                jobId: ['$stateParams', ($stateParams: any) => {
                    return $stateParams.jobId ? parseInt($stateParams.jobId, 10) : null;
                }],
                loadModule: ['$ocLazyLoad', ($ocLazyLoad: oc.ILazyLoad) => {
                    return $ocLazyLoad.load([
                        'dist/nationwide.js',
                        'dist/nationwide.css'
                    ]);
                }]
            }
        });
        return this;
    }

    private configureCSState(): this {
        this.$stateProvider.state("cs", {
            url: "/CS",
            redirectTo: "jobSearch"  // Redirect to the new lazy-loaded route
        });
        return this;
    }

    private configureJobSearchState(): this {
        this.$stateProvider.state("jobSearch", {
            url: "/jobSearch",
            resolve: {
                loadModule: ['$ocLazyLoad', ($ocLazyLoad: oc.ILazyLoad) => {
                    return $ocLazyLoad.load('dist/jobSearch.js');
                }]
            },
            component: "jobSearchComponent",
        });
        return this;
    }


    private configurePrebooksState(): this {
        this.$stateProvider.state("recurringJobs", {
            url: "/recurringJobs",
            resolve: {
                loadModule: ['$ocLazyLoad', ($ocLazyLoad: oc.ILazyLoad) => {
                    return $ocLazyLoad.load('dist/recurringJobs.js');
                }]
            },
            component: "recurringJobsComponent",
        });
        return this;
    }

    private configureOverviewState(): this {
        this.$stateProvider.state("overview", {
            url: "/overview",
            resolve: {
                loadModule: ['$ocLazyLoad', ($ocLazyLoad: oc.ILazyLoad) => {
                    return $ocLazyLoad.load([
                        'dist/overview.js',
                        'dist/overview.css'
                    ]);
                }]
            },
            template: '<overview-component></overview-component>'
        });
        return this;
    }

    private configureMegaMapState(): this {
        this.$stateProvider.state("megaMap", {
            url: "/megaMap",
            resolve: {
                loadModule: ['$ocLazyLoad', ($ocLazyLoad: oc.ILazyLoad) => {
                    return $ocLazyLoad.load([
                        'dist/megaMap.js',
                        'dist/megaMap.css'
                    ]);
                }]
            },
            component: "megaMapComponent",
        });
        return this;
    }

    private configureTaskDashboardState(): this {
        this.$stateProvider.state("taskDashboard", {
            url: "/taskDashboard",
            resolve: {
                loadModule: ['$ocLazyLoad', ($ocLazyLoad: oc.ILazyLoad) => {
                    return $ocLazyLoad.load([
                        'dist/taskDashboard.js',
                        'dist/taskDashboard.css'
                    ]);
                }]
            },
            component: "taskDashboardComponent",
        });
        return this;
    }
}

export default RouterConfig;
