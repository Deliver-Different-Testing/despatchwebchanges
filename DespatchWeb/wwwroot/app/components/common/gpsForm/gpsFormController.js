/**
 * @typedef {Object} AddressDetails - Details related to the address in use.
 * @property {string} filledAddress - The fully formed address.
 * @property {number} lat - The latitude of the address.
 * @property {number} long - The longitude of the address.
 * @property {string} address - The address.
 * @property {string} suburb - The suburb of the address.
 * @property {string} postCode - The postal code of the address.
 */

/**
 * @typedef {Object} Suggestion - A suggested location returned from the autocompleteAddressSearch.
 * @property {string} id - The ID of the location.
 * @property {string} text - The textual representation of the location.
 */

/**
 * @typedef {Object} SuburbOption - An option for selection in the ourSuburbSearch.
 * @property {string} text - The textual representation of the suburb.
 * @property {string=} alias - The alias of the suburb.
 */

/**
 * A controller which handles the GPS Form popup
 * @class
 */
class GpsFormController {
    /**
     * Create a GpsFormController
     * @param {Object} $scope - The active AngularJS scope.
     * @param {Object} $timeout - The AngularJS wrapper for window.setTimeout.
     * @param {Object} $mdDialog - The AngularJS Material service for showing dialogs.
     * @param {Object} DispatchData - The service used for data dispatching.
     * @param {Object} toastrService - The service used for toast notifications.
     * @param {Object} NgMap - Wrapper for Google Maps provided by 'ngMap' library.
     * @param {AddressDetails} addressDetails - Details related to the address in use.
     * @param {Array.<SuburbOption>} suburbOptions - Options for suburbs.
     * @param {string} title - The title to display.
     * @param {string} submitLabel - The label to display on the submit button.
     */
    constructor($scope, $timeout, $mdDialog, DispatchData, toastrService, NgMap, addressDetails, suburbOptions, title, submitLabel) {
        this.$scope = $scope;
        this.$timeout = $timeout;
        this.$mdDialog = $mdDialog;
        this.DispatchData = DispatchData;
        this.toastrService = toastrService;
        this.NgMap = NgMap;

        this.isLoading = false;
        this.title = title;
        this.addressDetails = addressDetails;
        this.suburbOptions = suburbOptions;
        this.submitLabel = submitLabel
        this.ourSuburbSearchText = "";
        this.addressSearchText = "";
        this.ourSuburbSelectedItem = this.findSuburbByDistrict(addressDetails.suburb);

        $timeout(() => {
            this.mapDisplay = true;
        }, 500);

        NgMap.getMap().then(map => {
            console.log("Loading Map!")
            this.map = map;
            this.marker = map.markers[0];
            this.addressSearchAutocomplete(addressDetails.address).then(_ => console.log("Address Search Complete!"));
        });
    }

    /**
     * This function finds a suburb by its district.
     * @param {string} district - The district of the suburb.
     * @returns {SuburbOption|null} - The matched suburb or null.
     */
    findSuburbByDistrict(district) {
        let lowerCaseDistrict = district.toLowerCase();
        return this.suburbOptions.find(localSuburb =>
            localSuburb.text.toLowerCase() === lowerCaseDistrict ||
            (localSuburb.alias && localSuburb.alias.toLowerCase() === lowerCaseDistrict)
        );
    }

    /**
     * Transforms API suggestion data format into application-specific format.
     * @param {Object} data - Suggestion data from the DispatchData service.
     * @returns {Array.<Suggestion>} - Suggestions in application-specific format.
     */
    transformSuggestions(data) {
        return data.suggestions.map(obj => ({
            id: obj.locationId,
            text: obj.label.split(", ").reverse().join(", ")
        }))
    }

    /**
     * Searches amongst suburb options matching provided query.
     * @param {string} query - Query for searching amongst suburb options.
     * @returns {Array.<SuburbOption>} - Array of suburbs which matches provided query.
     */
    ourSuburbSearch(query) {
        return query ? this.suburbOptions.filter(suburb => (suburb.text.toLowerCase()
            .indexOf(query.toLowerCase()) !== -1)) : this.suburbOptions;
    }

    /**
     * Autocomplete the given address searchText
     * @param {string} searchText - Search text of the address to autocomplete.
     * @returns {Promise<Array.<Suggestion>>} - A promise that fulfils with a list of potential matches for the search text.
     */
    async addressSearchAutocomplete(searchText) {
        try {
            const suggestions = await this.DispatchData.autocompleteAddressSearch(searchText);
            return this.transformSuggestions(suggestions);
        } catch (error) {
            this.toastrService.showErrorToast(error.message);
        }
    }

    /**
     * Handles the selection of items from the address search.
     * @param {Object} item - A selected item from the address search.
     */
    async addressSearchItemSelected(item) {
        try {
            const data = await this.DispatchData.getGeoCodeInformation(item);
            const returnedLocation = data.Response.View[0].Result[0].Location;

            console.log("Suburb = " + returnedLocation.Address.District);
            console.log("PostCode = " + returnedLocation.Address.PostalCode);

            const mappedSub = this.findSuburbByDistrict(returnedLocation.Address.District);

            if (mappedSub !== undefined) {
                console.log(mappedSub);
                this.ourSuburbSelectedItem = mappedSub;
            } else {
                this.ourSuburbSelectedItem = null;
                this.toastrService.showWarningToast("Matching suburb could not be found from this address." +
                    "Please select manually.")
            }

            this.addressDetails.filledAddress = returnedLocation.Address.Label;
            this.addressDetails.lat = returnedLocation.DisplayPosition.Latitude;
            this.addressDetails.long = returnedLocation.DisplayPosition.Longitude;
            this.addressDetails.address = returnedLocation.Address.Label;
            this.addressDetails.suburb = returnedLocation.Address.District;
            this.addressDetails.postCode = returnedLocation.Address.PostalCode;

            const latLng = new google.maps.LatLng(returnedLocation.DisplayPosition.Latitude,
                returnedLocation.DisplayPosition.Longitude);
            this.map.setCenter(latLng);
            this.marker.setPosition(latLng);
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

        if (this.ourSuburbSelectedItem.id !== undefined) {
            addressDetails.our_suburb = this.ourSuburbSelectedItem.id;
        }

        if (addressDetails.our_suburb === undefined) {
            const alert = this.$mdDialog.alert({
                title: 'Courier Suburb Not Mapped',
                textContent: 'You must pick one of our suburbs to map this address to',
                ok: 'OK',
            }); // Show the alert dialog
            await this.$mdDialog.show(alert);

            this.isLoading = false;
            return;
        }

        // Pass back to function that called dialog for processing
        this.isLoading = false;
        this.$mdDialog.hide(addressDetails);
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
        this.$scope.$apply();
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
            this.DispatchData.retrieveAddresses(location.lat(), location.lng()).then(data => {
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
            this.toastrService.showErrorToast(error.message);
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
