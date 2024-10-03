angular.module('uDispatch').directive('flightDataTable', ['NWData', 'versionUrl', (NWData, versionUrl) => ({
    restrict: 'E',
    templateUrl: versionUrl("app/components/Nationwide/directives/flight-table/flight-table.html"),
    scope: {
        // You can add isolated scope properties here if needed
    },
    controller: $scope => {
        $scope.flights = [];
        $scope.pagedFlights = [];
        $scope.loading = false;
        $scope.error = null;

        $scope.query = {
            limit: 10,
            page: 1
        };

        $scope.getFlightOptions = async (departureDate, departureAirportId) => {
            $scope.loading = true;
            $scope.error = null;

            try {
                $scope.flights = await NWData.getFlightOptions(departureDate, departureAirportId);
                $scope.updatePagedFlights();
            } catch (error) {
                console.error("Error fetching flight options:", error);
                $scope.error = "Failed to fetch flight options. Please try again.";
            } finally {
                $scope.loading = false;
                $scope.$apply(); // Ensure the view updates
            }
        };

        $scope.updatePagedFlights = () => {
            const start = ($scope.query.page - 1) * $scope.query.limit;
            const end = start + $scope.query.limit;
            $scope.pagedFlights = $scope.flights.slice(start, end);
        };

        $scope.onPaginate = (page, limit) => {
            $scope.query.page = page;
            $scope.query.limit = limit;
            $scope.updatePagedFlights();
        };

        // Add more functions here as needed, such as sorting, filtering, etc.
    }
})]);
