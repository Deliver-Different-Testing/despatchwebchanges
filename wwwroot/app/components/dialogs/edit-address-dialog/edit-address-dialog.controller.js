/**
 * @fileoverview Controller for the Edit Address Dialog in the uDispatch application.
 * @module EditAddressDialogController
 */

class EditAddressDialogController {
    /**
     * @type {string[]}
     * @static
     * @description List of dependencies to be injected.
     */
    static $inject = ["$scope", "$timeout", "$mdDialog", "DispatchData", "toastrService", "NgMap", "APP_CONFIG", "UsStatesService", "addressDetails", "suburbOptions", "title", "submitLabel"];

    /**
     * Create an EditAddressDialogController.
     * @param {Object} $scope - Angular scope object.
     * @param {Object} $timeout - Angular's wrapper for window.setTimeout.
     * @param {Object} $mdDialog - Angular Material dialog service.
     * @param {Object} DispatchData - Service for dispatch data operations.
     * @param {Object} toastrService - Service for displaying toast notifications.
     * @param {Object} NgMap - Angular Google Maps wrapper service.
     * @param {Object} APP_CONFIG - Application configuration object.
     * @param {Object} UsStatesService - Service for US states data.
     * @param {AddressDetails} addressDetails - Details related to the address in use.
     * @param {SuburbOption[]} suburbOptions - Options for suburbs.
     * @param {string} title - The title to display.
     * @param {string} submitLabel - The label to display on the submit button.
     */
    constructor($scope, $timeout, $mdDialog, DispatchData, toastrService, NgMap, APP_CONFIG, UsStatesService, addressDetails, suburbOptions, title, submitLabel) {
        this._$scope = $scope;
        this.$mdDialog = $mdDialog;
        this.dispatchData = DispatchData;
        this.toastrService = toastrService;
        this.UsStatesService = UsStatesService;

        /** @type {boolean} */
        this.isLoading = false;
        /** @type {string} */
        this.title = title;
        /** @type {AddressDetails} */
        this.addressDetails = addressDetails;
        /** @type {SuburbOption[]} */
        this.suburbOptions = suburbOptions;
        /** @type {string} */
        this.submitLabel = submitLabel;
        /** @type {boolean} */
        this.useUsFormat = APP_CONFIG.US_Customer;
        /** @type {string} */
        this.ourSuburbSearchText = "";
        /** @type {string} */
        this.addressSearchText = "";

        if (!this.useUsFormat) {
            this.ourSuburbSelectedItem = this._findSuburbByDistrict(addressDetails.suburb);
        }

        // Initialize US-specific fields if using US format
        if (this.useUsFormat) {
            this.addressDetails.city = addressDetails.addressLine5;
            this.addressDetails.stateAbbrev = UsStatesService.getStateByName(addressDetails.addressLine6).abbreviation;
            this.addressDetails.state = addressDetails.addressLine6;
            this.addressDetails.zipCode = addressDetails.addressLine7;
            this.addressDetails.latitude = addressDetails.latitude;
            this.addressDetails.longitude = addressDetails.longitude;
            this.addressDetails.address = addressDetails.fullAddress;

            this.UsStates = UsStatesService.getStates();
        }

        this._initializeMap($timeout, NgMap);
    }

    /**
     * Initialize the map.
     * @param {Object} $timeout - Angular's wrapper for window.setTimeout.
     * @param {Object} NgMap - Angular Google Maps wrapper service.
     * @private
     */
    _initializeMap($timeout, NgMap) {
        $timeout(() => {
            this.mapDisplay = true;
        }, 500);

        NgMap.getMap().then(map => {
            console.log("Loading Map!");
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

            this.addressSearchAutocomplete(this.addressDetails.address).then(_ => console.log("Address Search Complete!"));
        });
    }

    /**
     * This function finds a suburb by its district.
     * @param {string} district - The district of the suburb.
     * @returns {SuburbOption|undefined} - The matched suburb or undefined.
     * @private
     */
    _findSuburbByDistrict(district) {
        let lowerCaseDistrict = district.toLowerCase();
        return this.suburbOptions.find(localSuburb => localSuburb.text.toLowerCase() === lowerCaseDistrict || (localSuburb.alias && localSuburb.alias.toLowerCase() === lowerCaseDistrict));
    }

    /**
     * Transforms API suggestion data format into application-specific format.
     * @param {Object} data - Suggestion data from the DispatchData service.
     * @returns {Array<{id: string, text: string}>} Transformed suggestions.
     * @private
     */
    _transformSuggestions(data) {
        return data.suggestions.map(obj => ({
            id: obj.locationId, text: obj.label.split(", ").reverse().join(", ")
        }))
    }

    /**
     * Searches amongst suburb options matching provided query.
     * @param {string} query - Query for searching amongst suburb options.
     * @returns {SuburbOption[]} Filtered suburb options.
     */
    ourSuburbSearch(query) {
        return query ? this.suburbOptions.filter(suburb => (suburb.text.toLowerCase()
            .indexOf(query.toLowerCase()) !== -1)) : this.suburbOptions;
    }

    /**
     * Autocomplete the given address searchText
     * @param {string} searchText - Search text of the address to autocomplete.
     * @returns {Promise<Array<{id: string, text: string}>>} A promise that resolves to the autocomplete suggestions.
     */
    async addressSearchAutocomplete(searchText) {
        try {
            const suggestions = await this.dispatchData.autocompleteAddressSearch(searchText);
            return this._transformSuggestions(suggestions);
        } catch (error) {
            this.toastrService.showErrorToast(error.message);
        }
    }

    /**
     * Handles the selection of items from the address search.
     * @param {Object} item - A selected item from the address search.
     * @returns {Promise<void>}
     */
    async addressSearchItemSelected(item) {
        try {
            const data = await this.dispatchData.getGeoCodeInformation(item);
            const returnedLocation = data.Response.View[0].Result[0].Location;

            console.log(`Suburb/City = ${returnedLocation.Address.District}`);
            console.log(`PostCode/ZIP = ${returnedLocation.Address.PostalCode}`);

            if (this.useUsFormat) {
                this._handleUsFormatAddress(returnedLocation);
            } else {
                this._handleNonUsFormatAddress(returnedLocation);
            }

            this._updateAddressDetails(returnedLocation);
            this.updateMapMarker(returnedLocation);
        } catch (error) {
            console.log("Error: ", error);
        }
    }

    /**
     * Handle US format address update.
     * @param {Object} returnedLocation - The location data returned from geocoding.
     * @private
     */
    _handleUsFormatAddress(returnedLocation) {
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
    }

    /**
     * Handle non-US format address update.
     * @param {Object} returnedLocation - The location data returned from geocoding.
     * @private
     */
    _handleNonUsFormatAddress(returnedLocation) {
        const mappedSub = this._findSuburbByDistrict(returnedLocation.Address.District);
        if (mappedSub !== undefined) {
            console.log(mappedSub);
            this.ourSuburbSelectedItem = mappedSub;
        } else {
            this.ourSuburbSelectedItem = null;
            this.toastrService.showWarningToast("Matching suburb could not be found from this address. Please select manually.");
        }
        this.addressDetails.suburb = returnedLocation.Address.District;
        this.addressDetails.postCode = returnedLocation.Address.PostalCode;
    }

    /**
     * Update address details with new location data.
     * @param {Object} returnedLocation - The location data returned from geocoding.
     * @private
     */
    _updateAddressDetails(returnedLocation) {
        this.addressDetails.filledAddress = returnedLocation.Address.Label;
        this.addressDetails.latitude = returnedLocation.DisplayPosition.Latitude;
        this.addressDetails.longitude = returnedLocation.DisplayPosition.Longitude;
        this.addressDetails.address = returnedLocation.Address.Label;
    }

    /**
     * Update map marker with new location data.
     * @param {Object} returnedLocation - The location data returned from geocoding.
     * @private
     */
    updateMapMarker(returnedLocation) {
        const latLng = new google.maps.LatLng(returnedLocation.DisplayPosition.Latitude, returnedLocation.DisplayPosition.Longitude);

        console.log("Setting map center to:", latLng.toString());
        this.map.setCenter(latLng);

        console.log("Marker before setPosition:", this.marker);
        this.marker.setPosition(latLng);
        console.log("Marker after setPosition:", this.marker);

        this.marker.setVisible(true);
    }

    /**
     * Submits provided address details.
     * @param {AddressDetails} addressDetails - Details related to the address to submit.
     * @returns {Promise<void>}
     */
    async submit(addressDetails) {
        console.log("Starting submit with address details:", addressDetails);
        this.isLoading = true;

        try {
            let addressData;
            console.log("Using US Format:", this.useUsFormat);

            if (this.useUsFormat) {
                console.log("Processing US address submission");
                if (!this.validateUsAddress(addressDetails)) {
                    console.warn("US address validation failed");
                    this.isLoading = false;
                    return;
                }

                // Get the full state name from the abbreviation
                console.log("Getting state info for abbreviation:", addressDetails.stateAbbrev);
                const stateObj = this.UsStatesService.getStateByAbbreviation(addressDetails.stateAbbrev);
                console.log("Retrieved state object:", stateObj);

                addressDetails.addressLine6 = stateObj.name;
                addressDetails.state = stateObj;
                console.log("Updated address details with full state name:", addressDetails);

                // Ensure fullAddress is up-to-date
                addressDetails.fullAddress = this.constructFullAddress(addressDetails);
                console.log("Constructed full address:", addressDetails.fullAddress);

                // Format data for US addresses
                addressData = {
                    addressLine1: addressDetails.addressLine1,
                    addressLine2: addressDetails.addressLine2,
                    addressLine3: addressDetails.addressLine3,
                    addressLine4: addressDetails.addressLine4,
                    addressLine5: addressDetails.addressLine5,
                    addressLine6: addressDetails.addressLine6,
                    addressLine7: addressDetails.addressLine7,
                    latitude: addressDetails.latitude,
                    longitude: addressDetails.longitude,
                    fullAddress: addressDetails.fullAddress
                };

                console.log("Formatted US address data:", addressData);
            } else {
                console.log("Processing NZ address submission");
                console.log("Selected suburb:", this.ourSuburbSelectedItem);

                // Validate NZ specific requirements
                if (this.ourSuburbSelectedItem.id === undefined) {
                    console.warn("NZ suburb validation failed - no suburb selected");
                    alert("You must pick one of our suburbs to map this address to");
                    this.isLoading = false;
                    return;
                }

                // Format data for NZ addresses
                addressData = {
                    address: addressDetails.address,
                    suburbId: this.ourSuburbSelectedItem.id,
                    suburbName: this.ourSuburbSelectedItem.text,
                    cbd: addressDetails.cbd || false,
                    latitude: addressDetails.latitude,
                    longitude: addressDetails.longitude
                };
                console.log("Formatted NZ address data:", addressData);
            }

            // Pass back formatted address data along with other required fields
            const result = {
                addressData: addressData,
                rate: addressDetails.rate,
                jobId: addressDetails.jobId,
                despatcherName: addressDetails.despatcherName,
                prebook: addressDetails.prebook || false,
            };

            console.log("Final result object to be returned:", result);

            this.isLoading = false;
            console.log("Submitting result to dialog");
            this.$mdDialog.hide(result);
            console.log("Dialog submission complete");
        } catch (error) {
            this.isLoading = false;
            console.error("Error in submit function:", error);
            console.error("Error stack:", error.stack);
            console.error("Error occurred with address details:", addressDetails);
            this.toastrService.showErrorToast("Error updating address. Please try again or contact support");
            throw error; // Re-throw to maintain error chain
        }
    }

    /**
     * Validate US format address.
     * @param {AddressDetails} addressDetails - The address details to validate.
     * @returns {boolean} True if the address is valid, false otherwise.
     */
    validateUsAddress(addressDetails) {
        if (!addressDetails.addressLine4 || !addressDetails.addressLine5 || !addressDetails.stateAbbrev) {
            alert("Please fill in all required fields (Street, City, and State)");
            return false;
        }

        const stateObj = this.UsStatesService.getStateByAbbreviation(addressDetails.stateAbbrev);
        if (!stateObj) {
            alert("Please select a valid US state");
            return false;
        }

        return true;
    }

    /**
     * Construct full address from address details.
     * @param {AddressDetails} addressDetails - The address details.
     * @returns {string} The constructed full address.
     */
    constructFullAddress(addressDetails) {
        return [addressDetails.addressLine1, addressDetails.addressLine2, addressDetails.addressLine3, addressDetails.addressLine4, addressDetails.addressLine5, addressDetails.addressLine6, addressDetails.addressLine7, addressDetails.addressLine8].filter(line => line && line.trim() !== "").join(", ");
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
        this.addressDetails.latitude = event.latLng.lat();
        this.addressDetails.longitude = event.latLng.lng();
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
            this.dispatchData.retrieveAddresses(location.lat(), location.lng()).then(data => {
                const returnedLocation = data.Response.View[0].Result[0].Location;

                // Updating scope variables with new data
                this.addressDetails.address = returnedLocation.Address.Label;
                this.addressDetails.suburb = returnedLocation.Address.District;
                this.addressDetails.latitude = returnedLocation.DisplayPosition.Latitude;
                this.addressDetails.longitude = returnedLocation.DisplayPosition.Longitude;

                // Log output
                console.log(`Suburb = ${returnedLocation.Address.District}`);
                console.log(`PostCode = ${returnedLocation.Address.PostalCode}`);

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
            this.toastrService.showErrorToast(error.message);
        }
    }

    /**
     * Update location values in addressDetails when place gets changed on the map.
     * @param {google.maps.places.PlaceResult} place - A result from the Google Places service.
     */
    placeChanged(place) {
        try {
            this.addressDetails.latitude = place.geometry.location.lat();
            this.addressDetails.longitude = place.geometry.location.lng();
            if (place.address_components.find(x => x.types[0] === "postal_code")) {
                this.addressDetails.postCode = place.address_components
                    .find(x => x.types[0] === "postal_code").long_name;
            }

            this.map.setCenter(place.geometry.location);
        } catch (error) {
            this.toastrService.showErrorToast(error.message);
        }
    }

    /**
     * Cancels the Angular Material Dialog
     */
    cancel() {
        this.$mdDialog.cancel();
    }
}

angular.module("uDispatch").controller("EditAddressDialogController", EditAddressDialogController);
