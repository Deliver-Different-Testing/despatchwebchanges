import app from "./app";
import {HomeController} from "./components/home/home.controller";
import {OverviewController} from "./components/overview/overview.controller";
import {MegaMapController} from "./components/overview/mega-map/mega-map.controller";
import {TaskDashboardController} from "./components/task-dashboard/task-dashboard.controller";

class RouterConfig {
    constructor(private $urlRouterProvider: angular.ui.IUrlRouterProvider,
                private $stateProvider: angular.ui.IStateProvider) {
        this.configureRoutes();
    }

    private configureRoutes(): void {
        // Set default route
        this.$urlRouterProvider.otherwise("/");

        // Configure states
        this.configureHomeState()
            .configureNationwideState()
            .configureCSState()
            .configurePrebooksState()
            .configureOverviewState()
            .configureMegaMapState()
            .configureTaskDashboardState();
    }

    private configureHomeState(): this {
        this.$stateProvider.state("home", {
            url: "/?jobId",
            template: require("./components/home/home.template.html"),
            controller: HomeController,
            controllerAs: "ctrl",
            params: {
                jobId: {
                    value: null,
                    squash: true
                }
            }
        });
        return this;
    }

    private configureNationwideState(): this {
        this.$stateProvider.state("nw", {
            url: "/Nationwide",
            template: require("./components/Nationwide/nationwide.template.html"),
            controller: "NationwideControl",
            reloadOnSearch: false
        });
        return this;
    }

    private configureCSState(): this {
        this.$stateProvider.state("cs", {
            url: "/CS",
            template: require("./components/CS/csView.html"),
            controller: "CSControl",
            reloadOnSearch: false
        });
        return this;
    }

    private configurePrebooksState(): this {
        this.$stateProvider.state("prebooks", {
            url: "/prebooks",
            template: require("./components/prebooks/prebookView.html"),
            controller: "PBControl",
            reloadOnSearch: false
        });
        return this;
    }

    private configureOverviewState(): this {
        this.$stateProvider.state("overview", {
            url: "/overview",
            template: require("./components/overview/overview.template.html"),
            controller: OverviewController,
            controllerAs: "ctrl",
            reloadOnSearch: false
        });
        return this;
    }

    private configureMegaMapState(): this {
        this.$stateProvider.state("megaMap", {
            url: "/megaMap",
            template: require("./components/overview/mega-map/mega-map.template.html"),
            controller: MegaMapController,
            controllerAs: "ctrl",
            reloadOnSearch: false
        });
        return this;
    }

    private configureTaskDashboardState(): this {
        this.$stateProvider.state("taskDashboard", {
            url: "/taskDashboard",
            template: require("./components/task-dashboard/task-dashboard.template.html"),
            controller: TaskDashboardController,
            controllerAs: "ctrl",
            reloadOnSearch: false
        });
        return this;
    }
}

// Register the configuration
app.config(["$urlRouterProvider", "$stateProvider",
    ($urlRouterProvider: angular.ui.IUrlRouterProvider,
     $stateProvider: angular.ui.IStateProvider) => {
        new RouterConfig($urlRouterProvider, $stateProvider);
    }
]);
