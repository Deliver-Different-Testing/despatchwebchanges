angular.module('uDispatch').directive('flightDataTable', ['NWData', 'versionUrl', (NWData, versionUrl) => ({
    restrict: 'E',
    templateUrl: versionUrl("app/components/Nationwide/directives/flight-table/flight-table.html"),
    scope: {
        flightOptions: '=',
        /** @type {Job} */
        currentJob: [],
    },
    controller: ['$scope', '$timeout', ($scope, $timeout) => {
        console.log('Flight directive open!');

        /** @type {FlightOptions[]} */
        $scope.flights = [];
        /** @type {FlightOptions[]} */
        $scope.pagedFlights = [];
        /** @type {boolean} */
        $scope.loading = false;
        /** @type {string|null} */
        $scope.error = null;

        /** @type {{limit: number, page: number}} */
        $scope.query = {
            limit: 10,
            page: 1
        };

        $scope.$watchGroup(['flightOptions', 'currentJob'], async (newValues, oldValues) => {
            console.log('WatchGroup Hit: ' + newValues + ' & ' + oldValues);

            if (newValues !== oldValues) {
                if ($scope.flightOptions) {
                    $scope.flights = $scope.flightOptions;
                    $scope.updatePagedFlights();
                } else if ($scope.departureDate && $scope.currentJob) {
                    try {
                        $scope.loading = true;
                        $scope.error = null;
                        $scope.flights = await NWData.getFlightOptions($scope.currentJob, $scope.departureDate);
                        $scope.updatePagedFlights();
                    } catch (error) {
                        console.error("Error fetching flight options:", error);
                        $scope.error = "Failed to fetch flight options. Please try again.";
                    } finally {
                        $scope.loading = false;
                        $timeout(() => $scope.$apply());
                    }
                }
            }
        });

        $scope.updatePagedFlights = () => {
            const start = ($scope.query.page - 1) * $scope.query.limit;
            const end = start + $scope.query.limit;
            $scope.pagedFlights = $scope.flights.slice(start, end);
        };

        /**
         * @param {number} page
         * @param {number} limit
         */
        $scope.onPaginate = (page, limit) => {
            $scope.query.page = page;
            $scope.query.limit = limit;
            $scope.updatePagedFlights();
        };

        // Add more functions here as needed, such as sorting, filtering, etc.
    }]
})]);
