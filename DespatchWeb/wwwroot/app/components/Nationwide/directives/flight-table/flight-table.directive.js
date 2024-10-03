/**
 * @ngdoc directive
 * @name uDispatch.directive:flightDataTable
 * @description
 * Directive for displaying and managing flight data in a table format.
 * @param {Object[]} flightOptions - Array of flight options to display
 * @param {Date} departureDate - The departure date for fetching flight options
 * @param {Number} departureAirportId - The ID of the departure airport for fetching flight options
 */
angular.module('uDispatch').directive('flightDataTable', ['NWData', 'versionUrl', (NWData, versionUrl) => ({
    restrict: 'E',
    templateUrl: versionUrl("app/components/Nationwide/directives/flight-table/flight-table.html"),
    scope: {
        flightOptions: '=',
        departureDate: '=',
        departureAirportId: '=',
        destinationAirportId: '='
    },
    controller: ['$scope', '$timeout', function ($scope, $timeout) {
        /** @type {Object[]} */
        $scope.flights = [];
        /** @type {Object[]} */
        $scope.pagedFlights = [];
        /** @type {Boolean} */
        $scope.loading = false;
        /** @type {String|null} */
        $scope.error = null;

        /** @type {{limit: Number, page: Number}} */
        $scope.query = {
            limit: 10,
            page: 1
        };

        /**
         * @description Watch for changes in flightOptions, departureDate, and departureAirportId
         * @param {Array} newValues - New values of watched variables
         * @param {Array} oldValues - Old values of watched variables
         * @returns {Promise<void>}
         */
        $scope.$watchGroup(['flightOptions', 'departureDate', 'departureAirportId'], async function (newValues, oldValues) {
            if (newValues !== oldValues) {
                if ($scope.flightOptions) {
                    $scope.flights = $scope.flightOptions;
                    $scope.updatePagedFlights();
                } else if ($scope.departureDate && $scope.departureAirportId && $scope.destinationAirportId) {
                    try {
                        $scope.loading = true;
                        $scope.error = null;
                        $scope.flights = await $scope.getFlightOptions($scope.departureDate, $scope.departureAirportId, $scope.destinationAirportId);
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

        /**
         * @description Update the paged flights based on the current query
         */
        $scope.updatePagedFlights = () => {
            const start = ($scope.query.page - 1) * $scope.query.limit;
            const end = start + $scope.query.limit;
            $scope.pagedFlights = $scope.flights.slice(start, end);
        };

        /**
         * @description Handle pagination changes
         * @param {Number} page - The new page Number
         * @param {Number} limit - The new limit per page
         */
        $scope.onPaginate = (page, limit) => {
            $scope.query.page = page;
            $scope.query.limit = limit;
            $scope.updatePagedFlights();
        };

        // Add more functions here as needed, such as sorting, filtering, etc.
    }]
})]);
