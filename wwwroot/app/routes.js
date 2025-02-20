import app from "./app";

class RouterConfig {
    /**
     * @param {Object} $urlRouterProvider
     * @param {Object} $stateProvider
     */
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
            .configureMegaMapState();
    }

    configureHomeState() {
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

    configureNationwideState() {
        this.$stateProvider.state("nw", {
            url: "/Nationwide",
            templateUrl: "app/components/Nationwide/nationwideView.html",
            controller: "NationwideControl",
            reloadOnSearch: false
        });
        return this;
    }

    configureCSState() {
        this.$stateProvider.state("cs", {
            url: "/CS",
            templateUrl: "app/components/CS/csView.html",
            controller: "CSControl",
            reloadOnSearch: false
        });
        return this;
    }

    configurePrebooksState() {
        this.$stateProvider.state("prebooks", {
            url: "/prebooks",
            templateUrl: "app/components/prebooks/prebookView.html",
            controller: "PBControl",
            reloadOnSearch: false
        });
        return this;
    }

    configureOverviewState() {
        this.$stateProvider.state("overview", {
            url: "/overview",
            templateUrl: "app/components/overview/overview.template.html",
            controller: "deliveryOverview",
            controllerAs: "ctrl",
            reloadOnSearch: false
        });
        return this;
    }

    configureMegaMapState() {
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
    ($urlRouterProvider, $stateProvider) => {
        new RouterConfig($urlRouterProvider, $stateProvider);
    }
]);
