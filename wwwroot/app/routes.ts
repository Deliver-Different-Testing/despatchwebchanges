import app from "./app";
import angular from "angular";

// HTML Templates
import homeViewTemplate from "./components/home/homeView.html";
import nationwideViewTemplate from "./components/Nationwide/nationwide.template.html";
import csViewTemplate from "./components/CS/csView.html";
import prebookViewTemplate from "./components/prebooks/prebookView.html";
import overviewViewTemplate from "./components/overview/overview.template.html";
import megaMapViewTemplate from "./components/overview/mega-map/mega-map.template.html";
import taskDashboardViewTemplate from "./components/task-dashboard/task-dashboard.template.html";

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
            template: homeViewTemplate,
            controller: "HomeControl",
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
            template: nationwideViewTemplate,
            controller: "NationwideControl",
            reloadOnSearch: false
        });
        return this;
    }

    private configureCSState(): this {
        this.$stateProvider.state("cs", {
            url: "/CS",
            template: csViewTemplate,
            controller: "CSControl",
            reloadOnSearch: false
        });
        return this;
    }

    private configurePrebooksState(): this {
        this.$stateProvider.state("prebooks", {
            url: "/prebooks",
            template: prebookViewTemplate,
            controller: "PBControl",
            reloadOnSearch: false
        });
        return this;
    }

    private configureOverviewState(): this {
        this.$stateProvider.state("overview", {
            url: "/overview",
            template: overviewViewTemplate,
            controller: "deliveryOverview",
            controllerAs: "ctrl",
            reloadOnSearch: false
        });
        return this;
    }

    private configureMegaMapState(): this {
        this.$stateProvider.state("megaMap", {
            url: "/megaMap",
            template: megaMapViewTemplate,
            controller: "megaMapController",
            controllerAs: "ctrl",
            reloadOnSearch: false
        });
        return this;
    }

    private configureTaskDashboardState(): this {
        this.$stateProvider.state("taskDashboard", {
            url: "/taskDashboard",
            template: taskDashboardViewTemplate,
            controller: "taskDashboardController",
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
