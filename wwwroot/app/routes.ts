import app from "./app";
import angular from "angular";

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
            .configureMegaMapState();
    }

    private configureHomeState(): this {
        this.$stateProvider.state("home", {
            url: "/?jobId",
            templateUrl: "app/components/home/homeView.html",
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
            templateUrl: "app/components/Nationwide/nationwide.template.html",
            controller: "NationwideControl",
            reloadOnSearch: false
        });
        return this;
    }

    private configureCSState(): this {
        this.$stateProvider.state("cs", {
            url: "/CS",
            templateUrl: "app/components/CS/csView.html",
            controller: "CSControl",
            reloadOnSearch: false
        });
        return this;
    }

    private configurePrebooksState(): this {
        this.$stateProvider.state("prebooks", {
            url: "/prebooks",
            templateUrl: "app/components/prebooks/prebookView.html",
            controller: "PBControl",
            reloadOnSearch: false
        });
        return this;
    }

    private configureOverviewState(): this {
        this.$stateProvider.state("overview", {
            url: "/overview",
            templateUrl: "app/components/overview/overview.template.html",
            controller: "deliveryOverview",
            controllerAs: "ctrl",
            reloadOnSearch: false
        });
        return this;
    }

    private configureMegaMapState(): this {
        this.$stateProvider.state("megaMap", {
            url: "/megaMap",
            templateUrl: "app/components/overview/mega-map/mega-map.template.html",
            controller: "megaMapController",
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
