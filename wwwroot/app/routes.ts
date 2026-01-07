import IDfrntStateParams from "./interfaces/DfrntStateParams.interface";

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
            // .configureMegaMapState() // Hidden temporarily
            .configureTaskDashboardState()
            .configureDriverManagementState()
            .configureCourierMapState()
            .configureErrorStates();
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
                jobId: ['$stateParams', ($stateParams: IDfrntStateParams) => {
                    return $stateParams.jobId ? parseInt($stateParams.jobId, 10) : null;
                }],
                manifest: ['$http', async ($http: angular.IHttpService) => {
                    try {
                        const response = await $http.get<Record<string, string>>('dist/manifest.json');
                        return response.data;
                    } catch {
                        console.warn('[ROUTES] Failed to load manifest for home state, using fallback names');
                        return {
                            'home.js': 'home.js',
                            'home.css': 'home.css'
                        };
                    }
                }],
                loadModule: ['$ocLazyLoad', 'manifest', ($ocLazyLoad: oc.ILazyLoad, manifest: Record<string, string>) => {
                    const getAssetPath = (filename: string) => `dist/${manifest[filename] || filename}`;
                    return $ocLazyLoad.load([
                        getAssetPath('home.js'),
                        getAssetPath('home.css')
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
                jobId: ['$stateParams', ($stateParams: IDfrntStateParams) => {
                    return $stateParams.jobId ? parseInt($stateParams.jobId, 10) : null;
                }],
                manifest: ['$http', async ($http: angular.IHttpService) => {
                    try {
                        const response = await $http.get<Record<string, string>>('dist/manifest.json');
                        return response.data;
                    } catch {
                        console.warn('[ROUTES] Failed to load manifest for nationwide state, using fallback names');
                        return {
                            'nationwide.js': 'nationwide.js',
                            'nationwide.css': 'nationwide.css'
                        };
                    }
                }],
                loadModule: ['$ocLazyLoad', 'manifest', ($ocLazyLoad: oc.ILazyLoad, manifest: Record<string, string>) => {
                    const getAssetPath = (filename: string) => `dist/${manifest[filename] || filename}`;
                    return $ocLazyLoad.load([
                        getAssetPath('nationwide.js'),
                        getAssetPath('nationwide.css')
                    ]);
                }]
            }
        });
        return this;
    }

    private configureCSState(): this {
        this.$stateProvider.state("cs", {
            url: "/CS",
            redirectTo: "jobSearch"
        });
        return this;
    }

    private configureJobSearchState(): this {
        this.$stateProvider.state("jobSearch", {
            url: "/jobSearch",
            resolve: {
                manifest: ['$http', async ($http: angular.IHttpService) => {
                    try {
                        const response = await $http.get<Record<string, string>>('dist/manifest.json');
                        return response.data;
                    } catch {
                        console.warn('[ROUTES] Failed to load manifest for jobSearch state, using fallback names');
                        return {
                            'jobSearch.js': 'jobSearch.js',
                            'jobSearch.css': 'jobSearch.css'
                        };
                    }
                }],
                loadModule: ['$ocLazyLoad', 'manifest', ($ocLazyLoad: oc.ILazyLoad, manifest: Record<string, string>) => {
                    const getAssetPath = (filename: string) => `dist/${manifest[filename] || filename}`;
                    return $ocLazyLoad.load([
                        getAssetPath('jobSearch.js'),
                        getAssetPath('jobSearch.css')
                    ]);
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
                manifest: ['$http', async ($http: angular.IHttpService) => {
                    try {
                        const response = await $http.get<Record<string, string>>('dist/manifest.json');
                        return response.data;
                    } catch {
                        console.warn('[ROUTES] Failed to load manifest for recurringJobs state, using fallback names');
                        return {'recurringJobs.js': 'recurringJobs.css'};
                    }
                }],
                loadModule: ['$ocLazyLoad', 'manifest', ($ocLazyLoad: oc.ILazyLoad, manifest: Record<string, string>) => {
                    const getAssetPath = (filename: string) => `dist/${manifest[filename] || filename}`;
                    return $ocLazyLoad.load([
                        getAssetPath('recurringJobs.js'),
                        getAssetPath('recurringJobs.css')
                    ]);
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
                manifest: ['$http', async ($http: angular.IHttpService) => {
                    try {
                        const response = await $http.get<Record<string, string>>('dist/manifest.json');
                        return response.data;
                    } catch {
                        console.warn('[ROUTES] Failed to load manifest for overview state, using fallback names');
                        return {
                            'overview.js': 'overview.js',
                            'overview.css': 'overview.css'
                        };
                    }
                }],
                loadModule: ['$ocLazyLoad', 'manifest', ($ocLazyLoad: oc.ILazyLoad, manifest: Record<string, string>) => {
                    const getAssetPath = (filename: string) => `dist/${manifest[filename] || filename}`;
                    return $ocLazyLoad.load([
                        getAssetPath('overview.js'),
                        getAssetPath('overview.css')
                    ]);
                }]
            },
            template: '<overview-component></overview-component>'
        });
        return this;
    }

    // Hidden temporarily
    // private configureMegaMapState(): this {
    //     this.$stateProvider.state("megaMap", {
    //         url: "/megaMap",
    //         resolve: {
    //             manifest: ['$http', async ($http: angular.IHttpService) => {
    //                 try {
    //                     const response = await $http.get<Record<string, string>>('dist/manifest.json');
    //                     return response.data;
    //                 } catch {
    //                     console.warn('[ROUTES] Failed to load manifest for megaMap state, using fallback names');
    //                     return {
    //                         'megaMap.js': 'megaMap.js',
    //                         'megaMap.css': 'megaMap.css'
    //                     };
    //                 }
    //             }],
    //             loadModule: ['$ocLazyLoad', 'manifest', ($ocLazyLoad: oc.ILazyLoad, manifest: Record<string, string>) => {
    //                 const getAssetPath = (filename: string) => `dist/${manifest[filename] || filename}`;
    //                 return $ocLazyLoad.load([
    //                     getAssetPath('megaMap.js'),
    //                     getAssetPath('megaMap.css')
    //                 ]);
    //             }]
    //         },
    //         component: "megaMapComponent",
    //     });
    //     return this;
    // }

    private configureTaskDashboardState(): this {
        this.$stateProvider.state("taskDashboard", {
            url: "/taskDashboard",
            resolve: {
                manifest: ['$http', async ($http: angular.IHttpService) => {
                    try {
                        const response = await $http.get<Record<string, string>>('dist/manifest.json');
                        return response.data;
                    } catch {
                        console.warn('[ROUTES] Failed to load manifest for taskDashboard state, using fallback names');
                        return {
                            'taskDashboard.js': 'taskDashboard.js',
                            'taskDashboard.css': 'taskDashboard.css'
                        };
                    }
                }],
                loadModule: ['$ocLazyLoad', 'manifest', ($ocLazyLoad: oc.ILazyLoad, manifest: Record<string, string>) => {
                    const getAssetPath = (filename: string) => `dist/${manifest[filename] || filename}`;
                    return $ocLazyLoad.load([
                        getAssetPath('taskDashboard.js'),
                        getAssetPath('taskDashboard.css')
                    ]);
                }]
            },
            component: "taskDashboardComponent",
        });
        return this;
    }   
    
    private configureDriverManagementState(): this {
        this.$stateProvider.state("driverManagement", {
            url: "/driverManagement",
            resolve: {
                manifest: ['$http', async ($http: angular.IHttpService) => {
                    try {
                        const response = await $http.get<Record<string, string>>('dist/manifest.json');
                        return response.data;
                    } catch {
                        console.warn('[ROUTES] Failed to load manifest for taskDashboard state, using fallback names');
                        return {
                            'driverManagement.js': 'driverManagement.js',
                            'driverManagement.css': 'driverManagement.css'
                        };
                    }
                }],
                loadModule: ['$ocLazyLoad', 'manifest', ($ocLazyLoad: oc.ILazyLoad, manifest: Record<string, string>) => {
                    const getAssetPath = (filename: string) => `dist/${manifest[filename] || filename}`;
                    return $ocLazyLoad.load([
                        getAssetPath('driverManagement.js'),
                        getAssetPath('driverManagement.css')
                    ]);
                }]
            },
            component: "driverManagementComponent",
        });
        return this;
    }

    private configureCourierMapState(): this {
        this.$stateProvider.state("courierMap", {
            url: "/courierMap",
            resolve: {
                manifest: ['$http', async ($http: angular.IHttpService) => {
                    try {
                        const response = await $http.get<Record<string, string>>('dist/manifest.json');
                        return response.data;
                    } catch {
                        console.warn('[ROUTES] Failed to load manifest for courierMap state, using fallback names');
                        return {
                            'courierMap.js': 'courierMap.js',
                            'courierMap.css': 'courierMap.css'
                        };
                    }
                }],
                loadModule: ['$ocLazyLoad', 'manifest', ($ocLazyLoad: oc.ILazyLoad, manifest: Record<string, string>) => {
                    const getAssetPath = (filename: string) => `dist/${manifest[filename] || filename}`;
                    return $ocLazyLoad.load([
                        getAssetPath('courierMap.js'),
                        getAssetPath('courierMap.css')
                    ]);
                }]
            },
            component: "courierMapComponent",
        });
        return this;
    }

    private configureErrorStates(): this {
        // 404 Not Found
        this.$stateProvider.state("notFound", {
            url: "/not-found",
            template: '<error-page error-type="notFound"></error-page>'
        });

        // General Error
        this.$stateProvider.state("error", {
            url: "/error",
            template: '<error-page error-type="error"></error-page>'
        });

        // Access Denied
        this.$stateProvider.state("forbidden", {
            url: "/forbidden",
            template: '<error-page error-type="forbidden"></error-page>'
        });

        // Server Error
        this.$stateProvider.state("serverError", {
            url: "/server-error",
            template: '<error-page error-type="serverError"></error-page>'
        });

        return this;
    }
}

export default RouterConfig;