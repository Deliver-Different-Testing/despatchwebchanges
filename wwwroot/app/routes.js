"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
class RouterConfig {
    constructor($urlRouterProvider, $stateProvider) {
        this.$urlRouterProvider = $urlRouterProvider;
        this.$stateProvider = $stateProvider;
        this.configureRoutes();
    }
    configureRoutes() {
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
    configureHomeState() {
        this.$stateProvider.state("home", {
            url: "/?jobId",
            template: require("./components/home/homeView.html"),
            controller: "HomeControl",
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
    configureNationwideState() {
        this.$stateProvider.state("nw", {
            url: "/Nationwide",
            template: require("./components/Nationwide/nationwide.template.html"),
            controller: "NationwideControl",
            reloadOnSearch: false
        });
        return this;
    }
    configureCSState() {
        this.$stateProvider.state("cs", {
            url: "/CS",
            template: require("./components/CS/csView.html"),
            controller: "CSControl",
            reloadOnSearch: false
        });
        return this;
    }
    configurePrebooksState() {
        this.$stateProvider.state("prebooks", {
            url: "/prebooks",
            template: require("./components/prebooks/prebookView.html"),
            controller: "PBControl",
            reloadOnSearch: false
        });
        return this;
    }
    configureOverviewState() {
        this.$stateProvider.state("overview", {
            url: "/overview",
            template: require("./components/overview/overview.template.html"),
            controller: "deliveryOverview",
            controllerAs: "ctrl",
            reloadOnSearch: false
        });
        return this;
    }
    configureMegaMapState() {
        this.$stateProvider.state("megaMap", {
            url: "/megaMap",
            template: require("./components/overview/mega-map/mega-map.template.html"),
            controller: "megaMapController",
            controllerAs: "ctrl",
            reloadOnSearch: false
        });
        return this;
    }
    configureTaskDashboardState() {
        this.$stateProvider.state("taskDashboard", {
            url: "/taskDashboard",
            template: require("./components/task-dashboard/task-dashboard.template.html"),
            controller: "taskDashboardController",
            controllerAs: "ctrl",
            reloadOnSearch: false
        });
        return this;
    }
}
// Register the configuration
app_1.default.config(["$urlRouterProvider", "$stateProvider",
    ($urlRouterProvider, $stateProvider) => {
        new RouterConfig($urlRouterProvider, $stateProvider);
    }
]);
