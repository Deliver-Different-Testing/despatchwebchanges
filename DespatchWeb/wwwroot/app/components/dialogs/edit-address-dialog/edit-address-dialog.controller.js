/**
 * A controller which handles the GPS Form popup
 * @class
 */
class EditAddressDialogController {
    static $inject = ['$scope', '$timeout', '$mdDialog', 'DispatchData', 'toastrService', 'NgMap', 'APP_CONFIG', 'UsStatesService',
        'addressDetails', 'suburbOptions', 'title', 'submitLabel'];

    /**
     * @param $scope
     * @param $timeout
     * @param $mdDialog
     * @param DispatchData
     * @param toastrService
     * @param NgMap
     * @param APP_CONFIG
     * @param UsStatesService
     * @param {AddressDetails} addressDetails - Details related to the address in use.
     * @param {SuburbOption[]} suburbOptions - Options for suburbs.
     * @param {string} title - The title to display.
     * @param {string} submitLabel - The label to display on the submit button.
     */
    constructor($scope, $timeout, $mdDialog, DispatchData, toastrService, NgMap, APP_CONFIG, UsStatesService,
                addressDetails, suburbOptions, title, submitLabel) {
        this._$scope = $scope;
        this._$mdDialog = $mdDialog;
        this._dispatchData = DispatchData;
        this._toastrService = toastrService;
        this.UsStatesService = UsStatesService;

        this.isLoading = false;
        this.title = title;
        this.addressDetails = addressDetails;
        this.suburbOptions = suburbOptions;
        this.submitLabel = submitLabel
        this.useUsFormat = APP_CONFIG.US_Customer;
        this.ourSuburbSearchText = "";
        this.addressSearchText = "";

        if (!this.useUsFormat) {
            this.ourSuburbSelectedItem = this._findSuburbByDistrict(addressDetails.suburb);
        }

        // Initialize US-specific fields if using US format
        if (this.useUsFormat) {
            this.addressDetails.city = addressDetails.addressLine5;
            this.addressDetails.state = UsStatesService.getStateByName(addressDetails.addressLine6);
            this.addressDetails.zipCode = addressDetails.addressLine7;
            this.UsStates = UsStatesService.getStates();
            this.addressDetails.lat = addressDetails.latitude;
            this.addressDetails.long = addressDetails.longitude;
            this.addressDetails.address = addressDetails.fullAddress;
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
                this.addressDetails.addressLine1 = returnedLocation.Address.Place;
                this.addressDetails.addressLine2 = returnedLocation.Address.Subunit;
                this.addressDetails.addressLine3 = returnedLocation.Address.HouseNumber;
                this.addressDetails.addressLine4 = returnedLocation.Address.Street;
                this.addressDetails.addressLine5 = returnedLocation.Address.City;
                this.addressDetails.addressLine6 = returnedLocation.Address.State;
                this.addressDetails.addressLine7 = returnedLocation.Address.PostalCode;

                const selectedState = this.UsStatesService.getStateByAbbreviation(returnedLocation.Address.State);
                if (selectedState) {
                    this.addressDetails.stateName = selectedState.name;
                    this.addressDetails.state = selectedState;
                }
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
            if (!addressDetails.addressLine4 || !addressDetails.addressLine5 || !addressDetails.addressLine6) {
                alert("Please fill in all required fields (City, State, and ZIP Code)");
                this.isLoading = false;
                return;
            }

            // Use the UsStatesService to validate the state if needed
            const stateObj = this.UsStatesService.getStateByAbbreviation(addressDetails.addressLine5);
            if (!stateObj) {
                alert("Please enter a valid US state abbreviation");
                this.isLoading = false;
                return;
            }

            addressDetails.fullAddress = [addressDetails.addressLine1, addressDetails.addressLine2, addressDetails.addressLine3, addressDetails.addressLine4, addressDetails.addressLine5, addressDetails.addressLine6, addressDetails.addressLine7, addressDetails.addressLine8].filter(line => line && line.trim() !== '').join(', ');
        }

        // Ensure fullAddress is up-to-date

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
     * Cancels the Angular Material Dialog
     */
    cancel() {
        this._$mdDialog.cancel();
    }
}

angular.module('uDispatch').controller('EditAddressDialogController', EditAddressDialogController);
