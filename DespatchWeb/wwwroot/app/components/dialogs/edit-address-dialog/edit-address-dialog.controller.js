/**
 * A controller which handles the GPS Form popup
 * @class
 */
class EditAddressDialogController {
    static $inject = [
        '$scope',
        '$timeout',
        '$mdDialog',
        'DispatchData',
        'toastrService',
        'NgMap',
        'APP_CONFIG',
        'addressDetails',
        'suburbOptions',
        'title',
        'submitLabel'
    ];

    /**
     * @param $scope - The active AngularJS scope.
     * @param $timeout - The AngularJS wrapper for window.setTimeout.
     * @param $mdDialog - The AngularJS Material service for showing dialogs.
     * @param DispatchData - The service used for data dispatching.
     * @param toastrService - The service used for toast notifications.
     * @param NgMap - Wrapper for Google Maps provided by 'ngMap' library.
     * @param APP_CONFIG
     * @param {AddressDetails} addressDetails - Details related to the address in use.
     * @param {SuburbOption[]} suburbOptions - Options for suburbs.
     * @param {string} title - The title to display.
     * @param {string} submitLabel - The label to display on the submit button.
     */
    constructor($scope, $timeout, $mdDialog, DispatchData, toastrService, NgMap, APP_CONFIG, addressDetails, suburbOptions, title, submitLabel) {
        this._$scope = $scope;
        this._$mdDialog = $mdDialog;
        this._dispatchData = DispatchData;
        this._toastrService = toastrService;

        this.isLoading = false;
        this.title = title;
        this.addressDetails = addressDetails;
        this.suburbOptions = suburbOptions;
        this.submitLabel = submitLabel
        this.useUsFormat = APP_CONFIG.US_Customer;
        this.ourSuburbSearchText = "";
        this.addressSearchText = "";
        this.ourSuburbSelectedItem = this._findSuburbByDistrict(addressDetails.suburb);

        // Initialize US-specific fields if using US format
        if (this.useUsFormat) {
            this.addressDetails.city = this.addressDetails.suburb;
            this.addressDetails.state = "";
            this.addressDetails.zipCode = this.addressDetails.postCode;
            this.states = this._getUsStates();
        }

        $timeout(() => {
            this.mapDisplay = true;
        }, 500);

        NgMap.getMap().then(map => {
            console.log("Loading Map!")
            this.map = map;
            console.log("Map markers:", map.markers);

            if (!map.markers || map.markers.length === 0) {
                console.log("No markers found. Creating a new one.");
                this.marker = new google.maps.Marker({
                    position: new google.maps.LatLng(this.addressDetails.lat, this.addressDetails.long),
                    map: this.map,
                    visible: true
                });
            } else {
                this.marker = map.markers[0];
            }

            console.log("Marker initialized:", this.marker);

            this.addressSearchAutocomplete(addressDetails.address).then(_ => console.log("Address Search Complete!"));
        });
    }

    /**
     * This function finds a suburb by its district.
     * @param {string} district - The district of the suburb.
     * @returns {SuburbOption|null} - The matched suburb or null.
     */
    _findSuburbByDistrict(district) {
        let lowerCaseDistrict = district.toLowerCase();
        return this.suburbOptions.find(localSuburb => localSuburb.text.toLowerCase() === lowerCaseDistrict || (localSuburb.alias && localSuburb.alias.toLowerCase() === lowerCaseDistrict));
    }

    /**
     * Transforms API suggestion data format into application-specific format.
     * @param {Object} data - Suggestion data from the DispatchData service.
     */
    _transformSuggestions(data) {
        return data.suggestions.map(obj => ({
            id: obj.locationId, text: obj.label.split(", ").reverse().join(", ")
        }))
    }

    /**
     * Searches amongst suburb options matching provided query.
     * @param {string} query - Query for searching amongst suburb options.
     */
    ourSuburbSearch(query) {
        return query ? this.suburbOptions.filter(suburb => (suburb.text.toLowerCase()
            .indexOf(query.toLowerCase()) !== -1)) : this.suburbOptions;
    }

    /**
     * Autocomplete the given address searchText
     * @param {string} searchText - Search text of the address to autocomplete.
     */
    async addressSearchAutocomplete(searchText) {
        try {
            const suggestions = await this._dispatchData.autocompleteAddressSearch(searchText);
            return this._transformSuggestions(suggestions);
        } catch (error) {
            this._toastrService.showErrorToast(error.message);
        }
    }

    /**
     * Handles the selection of items from the address search.
     * @param {Object} item - A selected item from the address search.
     */
    async addressSearchItemSelected(item) {
        try {
            const data = await this._dispatchData.getGeoCodeInformation(item);
            const returnedLocation = data.Response.View[0].Result[0].Location;

            console.log("Suburb/City = " + returnedLocation.Address.District);
            console.log("PostCode/ZIP = " + returnedLocation.Address.PostalCode);

            if (this.useUsFormat) {
                this.addressDetails.city = returnedLocation.Address.City;
                this.addressDetails.state = returnedLocation.Address.State;
                this.addressDetails.zipCode = returnedLocation.Address.PostalCode;
            } else {
                const mappedSub = this._findSuburbByDistrict(returnedLocation.Address.District);
                if (mappedSub !== undefined) {
                    console.log(mappedSub);
                    this.ourSuburbSelectedItem = mappedSub;
                } else {
                    this.ourSuburbSelectedItem = null;
                    this._toastrService.showWarningToast("Matching suburb could not be found from this address. Please select manually.");
                }
                this.addressDetails.suburb = returnedLocation.Address.District;
                this.addressDetails.postCode = returnedLocation.Address.PostalCode;
            }

            this.addressDetails.filledAddress = returnedLocation.Address.Label;
            this.addressDetails.lat = returnedLocation.DisplayPosition.Latitude;
            this.addressDetails.long = returnedLocation.DisplayPosition.Longitude;
            this.addressDetails.address = returnedLocation.Address.Label;

            const latLng = new google.maps.LatLng(returnedLocation.DisplayPosition.Latitude, returnedLocation.DisplayPosition.Longitude);

            console.log("Setting map center to:", latLng.toString());
            this.map.setCenter(latLng);

            console.log("Marker before setPosition:", this.marker);
            this.marker.setPosition(latLng);
            console.log("Marker after setPosition:", this.marker);

            this.marker.setVisible(true);
        } catch (error) {
            console.log("Error: ", error);
        }
    }

    /**
     * Submits provided address details.
     * @param {AddressDetails} addressDetails - Details related to the address to submit.
     */
    async submit(addressDetails) {
        this.isLoading = true;

        if (!this.useUsFormat) {
            if (this.ourSuburbSelectedItem.id !== undefined) {
                addressDetails.our_suburb = this.ourSuburbSelectedItem.id;
            }

            if (addressDetails.our_suburb === undefined) {
                alert("You must pick one of our suburbs to map this address to");
                this.isLoading = false;
                return;
            }
        } else {
            // Validation for US format
            if (!addressDetails.city || !addressDetails.state || !addressDetails.zipCode) {
                alert("Please fill in all required fields (City, State, and ZIP Code)");
                this.isLoading = false;
                return;
            }
        }

        // Pass back to function that called dialog for processing
        this.isLoading = false;
        this._$mdDialog.hide(addressDetails);
    }

    /**
     * Copies the given address to the addressSearchText.
     * @param {string} address - The address to copy.
     */
    copyGpsAddress(address) {
        this.addressSearchText = address;
    }


    /**
     * Updates the latitude and longitude values in addressDetails when a marker on the map is moved.
     * @param {google.maps.MouseEvent} event - A Google Maps mouse event.
     */
    moveMarker(event) {
        this.addressDetails.lat = event.latLng.lat();
        this.addressDetails.long = event.latLng.lng();
        this._$scope.$apply();
    };

    /**
     * Updates addressDetails with new position data when the marker finishes being dragged.
     * @param {google.maps.MouseEvent} event - A Google Maps mouse event.
     */
    markerDragend(event) {
        // Get the marker's new position
        const location = event.latLng;

        try {
            // To use retrieveAddresses, you must ensure location.lat() and location.lng() are functions
            // that return the latitude and longitude values of your location
            this._dispatchData.retrieveAddresses(location.lat(), location.lng()).then(data => {
                const returnedLocation = data.Response.View[0].Result[0].Location;

                // Updating scope variables with new data
                this.addressDetails.address = returnedLocation.Address.Label;
                this.addressDetails.suburb = returnedLocation.Address.District;
                this.addressDetails.lat = returnedLocation.DisplayPosition.Latitude;
                this.addressDetails.long = returnedLocation.DisplayPosition.Longitude;

                // Log output
                console.log("Suburb = " + returnedLocation.Address.District);
                console.log("PostCode = " + returnedLocation.Address.PostalCode);

                // Updating suburb selection
                const mappedSub = this.suburbOptions.find(obj => obj.text === returnedLocation.Address.District || obj.alias === returnedLocation.Address.District);

                if (mappedSub !== undefined) {
                    console.log(mappedSub);
                    this.ourSuburbSelectedItem = mappedSub;
                } else {
                    this.ourSuburbSelectedItem = null;
                }

            });
        } catch (error) {
            this._toastrService.showErrorToast(error.message);
        }
    }

    /**
     * Update location values in addressDetails when place gets changed on the map.
     * @param {google.maps.places.PlaceResult} place - A result from the Google Places service.
     */
    placeChanged(place) {
        try {
            this.addressDetails.lat = place.geometry.location.lat();
            this.addressDetails.long = place.geometry.location.lng();
            if (place.address_components.find(x => x.types[0] === "postal_code")) {
                this.addressDetails.postCode = place.address_components
                    .find(x => x.types[0] === "postal_code").long_name;
            }

            this.map.setCenter(place.geometry.location);
        } catch (error) {
            this._toastrService.showErrorToast(error.message);
        }
    }

    /**
     * Returns an array of US states and territories for dropdown menus.
     * @returns {Array<{abbreviation: string, name: string}>} An array of state objects with abbreviation and name.
     */
    _getUsStates() {
        return [
            {abbreviation: 'AL', name: 'Alabama'},
            {abbreviation: 'AK', name: 'Alaska'},
            {abbreviation: 'AZ', name: 'Arizona'},
            {abbreviation: 'AR', name: 'Arkansas'},
            {abbreviation: 'CA', name: 'California'},
            {abbreviation: 'CO', name: 'Colorado'},
            {abbreviation: 'CT', name: 'Connecticut'},
            {abbreviation: 'DE', name: 'Delaware'},
            {abbreviation: 'DC', name: 'District of Columbia'},
            {abbreviation: 'FL', name: 'Florida'},
            {abbreviation: 'GA', name: 'Georgia'},
            {abbreviation: 'HI', name: 'Hawaii'},
            {abbreviation: 'ID', name: 'Idaho'},
            {abbreviation: 'IL', name: 'Illinois'},
            {abbreviation: 'IN', name: 'Indiana'},
            {abbreviation: 'IA', name: 'Iowa'},
            {abbreviation: 'KS', name: 'Kansas'},
            {abbreviation: 'KY', name: 'Kentucky'},
            {abbreviation: 'LA', name: 'Louisiana'},
            {abbreviation: 'ME', name: 'Maine'},
            {abbreviation: 'MD', name: 'Maryland'},
            {abbreviation: 'MA', name: 'Massachusetts'},
            {abbreviation: 'MI', name: 'Michigan'},
            {abbreviation: 'MN', name: 'Minnesota'},
            {abbreviation: 'MS', name: 'Mississippi'},
            {abbreviation: 'MO', name: 'Missouri'},
            {abbreviation: 'MT', name: 'Montana'},
            {abbreviation: 'NE', name: 'Nebraska'},
            {abbreviation: 'NV', name: 'Nevada'},
            {abbreviation: 'NH', name: 'New Hampshire'},
            {abbreviation: 'NJ', name: 'New Jersey'},
            {abbreviation: 'NM', name: 'New Mexico'},
            {abbreviation: 'NY', name: 'New York'},
            {abbreviation: 'NC', name: 'North Carolina'},
            {abbreviation: 'ND', name: 'North Dakota'},
            {abbreviation: 'OH', name: 'Ohio'},
            {abbreviation: 'OK', name: 'Oklahoma'},
            {abbreviation: 'OR', name: 'Oregon'},
            {abbreviation: 'PA', name: 'Pennsylvania'},
            {abbreviation: 'RI', name: 'Rhode Island'},
            {abbreviation: 'SC', name: 'South Carolina'},
            {abbreviation: 'SD', name: 'South Dakota'},
            {abbreviation: 'TN', name: 'Tennessee'},
            {abbreviation: 'TX', name: 'Texas'},
            {abbreviation: 'UT', name: 'Utah'},
            {abbreviation: 'VT', name: 'Vermont'},
            {abbreviation: 'VA', name: 'Virginia'},
            {abbreviation: 'WA', name: 'Washington'},
            {abbreviation: 'WV', name: 'West Virginia'},
            {abbreviation: 'WI', name: 'Wisconsin'},
            {abbreviation: 'WY', name: 'Wyoming'}
        ];
    }

    /**
     * Cancels the Angular Material Dialog
     */
    cancel() {
        this._$mdDialog.cancel();
    }
}

angular.module('uDispatch').controller('EditAddressDialogController', EditAddressDialogController);
