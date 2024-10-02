angular.module('uDispatch').directive('flightDataTable', ['NWData', 'versionUrl', (NWData, versionUrl) => ({
    restrict: 'E',
    templateUrl: versionUrl("app/components/Nationwide/directives/flightDataTable.html"),
    scope: {
        // You can add isolated scope properties here if needed
    },
    controller: $scope => {
        $scope.flights = [];
        $scope.loading = false;
        $scope.error = null;

        $scope.getFlightOptions = async (departureDate, departureAirportId) => {
            $scope.loading = true;
            $scope.error = null;

            try {
                $scope.flights = await NWData.getFlightOptions(departureDate, departureAirportId);
            } catch (error) {
                console.error("Error fetching flight options:", error);
                $scope.error = "Failed to fetch flight options. Please try again.";
            } finally {
                $scope.loading = false;
                $scope.$apply(); // Ensure the view updates
            }
        };

        // Add more functions here as needed, such as sorting, filtering, etc.
    }
})]);
