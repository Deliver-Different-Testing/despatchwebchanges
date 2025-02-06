import app from "./app";

app.config(["$urlRouterProvider", "$stateProvider", ($urlRouterProvider, $stateProvider) => {
    // Set default route
    $urlRouterProvider.otherwise("/");

    $stateProvider
        .state("home", {
            url: "/?jobId",
            templateUrl: "app/components/home/homeView.html",
            controller: "HomeControl",
            params: {
                jobId: {
                    value: null,
                    squash: true
                }
            }
        })
        .state("nw", {
            url: "/Nationwide",
            templateUrl: "app/components/Nationwide/nationwideView.html",
            controller: "NationwideControl",
            reloadOnSearch: false
        })
        .state("cs", {
            url: "/CS",
            templateUrl: "app/components/CS/csView.html",
            controller: "CSControl",
            reloadOnSearch: false
        })
        .state("prebooks", {
            url: "/prebooks",
            templateUrl: "app/components/prebooks/prebookView.html",
            controller: "PBControl",
            reloadOnSearch: false
        })
        .state("overview", {
            url: "/overview",
            templateUrl: "app/components/overview/overview.template.html",
            controller: "deliveryOverview",
            controllerAs: "ctrl",
            reloadOnSearch: false
        })
        .state("megaMap", {
            url: "/megaMap",
            templateUrl: "app/components/overview/mega-map/mega-map.template.html",
            controller: "megaMapController",
            controllerAs: "ctrl",
            reloadOnSearch: false
        });
}]);
