import {EditAddressDialogViewModel, ShipmentDetails,} from "../../../interfaces/job.interface";
import BaseController from "../../base-controller";
import ToastrService from "../../../services/toastr.service";
import {AppConfig} from "../../../interfaces/app-config.interface";
import IStateInfo from "../../../interfaces/state-info.interface";
import ConfigService from "../../../services/config.service";
import {HereMapsLocationResult, Position,} from "../../../interfaces/heremaps-autocomplete.interfaces";
import {HereMapsLookupResponse,} from "../../../interfaces/hereMapsLookUp.interfaces";
import {getStateByAbbreviation, getStateByName, getStates} from "../../../functions/usStates";
import AddressLookupService from "../../../services/address-lookup.service";

class EditAddressDialogController extends BaseController {
    static $inject = [
        "$scope",
        "$timeout",
        "$interval",
        "$mdDialog",
        "toastrService",
        "NgMap",
        "APP_CONFIG",
        "configService",
        "addressLookupService",
        "addressDetails",
        "title",
        "submitLabel",
        "showContactInfo",
    ];

    isLoading: boolean = false;
    isAddressLoading: boolean = false;

    addressSearchText: string;
    googleMapsUrl?: string;
    mapDisplay?: boolean;
    map?: google.maps.Map;
    marker?: google.maps.Marker;
    usStateList: IStateInfo[];
    addressSearchResults: HereMapsLocationResult[] = [];
    selectedAddressId?: string;

    // Contact Card
    isContactCardExpanded: boolean = false;
    shipmentDetails?: ShipmentDetails;
    private readonly useUsFormat: boolean;

    constructor(
        private $scope: angular.IScope,
        $timeout: angular.ITimeoutService,
        $interval: angular.IIntervalService,
        private $mdDialog: angular.material.IDialogService,
        private toastrService: ToastrService,
        private NgMap: angular.map.INgMap,
        appConfig: AppConfig,
        private configService: ConfigService,
        private addressLookupService: AddressLookupService,
        public addressDetails: EditAddressDialogViewModel,
        public title: string,
        public submitLabel: string,
        public showContactInfo: boolean,
    ) {
        super();
        this.initServices($timeout, $interval);

        this.useUsFormat = appConfig.US_Customer;
        this.addressSearchText = this.addressDetails.fullAddress || "";

        if (this.showContactInfo) {
            this.isContactCardExpanded = true;
        }

        this.usStateList = getStates();

        if (
            this.addressDetails.addressLine6 &&
            !this.addressDetails.stateAbbreviation
        ) {
            const stateByName = getStateByName(
                this.addressDetails.addressLine6
            );
            if (stateByName) {
                this.addressDetails.stateAbbreviation = stateByName.abbreviation;
            }
        }

        this.registerTimeout(() => {
            this.mapDisplay = true;
        }, 500);

        this.configService
            .getGoogleMapsKey()
            .then((apiKey: string) => {
                this.googleMapsUrl = `https://maps.google.com/maps/api/js?key=${apiKey}&libraries=places`;

                return this.registerTimeout(() => {
                    return this.NgMap.getMap({id: "dispatchMap"});
                }, 1000);
            })
            .then((map) => {
                console.log("Loading Map!");
                this.map = map;
                const mapMarkers = map.get("markers") || [];
                console.log("Map markers:", mapMarkers);

                if (!mapMarkers.length) {
                    console.log("No markers found. Creating a new one.");
                    this.marker = new google.maps.Marker({
                        position: new google.maps.LatLng(
                            this.addressDetails.latitude ?? 0,
                            this.addressDetails.longitude ?? 0
                        ),
                        map: this.map,
                        visible: true,
                    });
                } else {
                    this.marker = mapMarkers[0];
                }

                this.registerTimeout(() => this.$scope.$apply());
                console.log("Marker initialized:", this.marker);
            });
    }

    async autocompleteAddressSearch(
        text: string
    ): Promise<HereMapsLocationResult[]> {
        try {
            const results = await this.addressLookupService.autocompleteAddressSearch(text);
            this.addressSearchResults = results;

           await this.$scope.$applyAsync()
            return results;
        } catch (error: any) {
            this.toastrService.showErrorToast(
                error.message || "Error searching for addresses"
            );
            console.error("Error in autocompleteAddressSearch:", error);
            return [];
        }
    }

    async addressSearchItemSelected(
        selectedItem: HereMapsLocationResult
    ): Promise<void> {
        try {
            console.log("Selected address item:", selectedItem);

            if (!selectedItem || !selectedItem.id) {
                console.warn("No valid address item selected");
                return;
            }

            this.isAddressLoading = true;

            this.selectedAddressId = selectedItem.id;

            const detailedLocation = await this.addressLookupService.getLocationDetailsById(
                selectedItem.id
            );

            if (detailedLocation) {
                this.handleAddressFieldsFromLookup(detailedLocation);
                this.updateMapMarker({
                    lat: detailedLocation.position.lat,
                    lng: detailedLocation.position.lng,
                });
            } else {
                this.updateMapMarker(selectedItem.position);
            }

            this.addressDetails.fullAddress = selectedItem.address.label;

            this.isAddressLoading = false;

        } catch (error: any) {
            console.error("Error processing selected address:", error);

            this.isAddressLoading = false;

            this.toastrService.showErrorToast(
                "An error occurred while processing the selected address. Please try again."
            );
        } finally {
            await this.$scope.$applyAsync()
        }
    }

    updateMapMarker(position: Position): void {
        const latLng = new google.maps.LatLng(position.lat, position.lng);

        console.log("Setting map center to:", latLng.toString());
        this.map?.setCenter(latLng);

        console.log("Marker before setPosition:", this.marker);
        this.marker?.setPosition(latLng);
        console.log("Marker after setPosition:", this.marker);

        this.marker?.setVisible(true);
        this.registerTimeout(() => this.$scope.$apply());
    }

    async submit(addressDetails: EditAddressDialogViewModel): Promise<void> {
        console.log("Starting submit with address details:", addressDetails);
        this.isLoading = true;

        try {
            console.log("Using US Format:", this.useUsFormat);

            if (this.useUsFormat) {
                console.log("Processing US address submission");
                if (!this.validateUsAddress(addressDetails)) {
                    console.warn("US address validation failed");
                    this.isLoading = false;
                    return;
                }

                // Get the full state name from the abbreviation
                console.log(
                    "Getting state info for abbreviation:",
                    addressDetails.stateAbbreviation
                );

                if (!addressDetails.stateAbbreviation) {
                    alert("Please select a valid US state");
                    return;
                }

                const stateObj = getStateByAbbreviation(
                    addressDetails.stateAbbreviation
                );
                console.log("Retrieved state object:", stateObj);

                addressDetails.addressLine6 = stateObj?.name ?? "";
                console.log(
                    "Updated address details with full state name:",
                    addressDetails
                );
            }

            // Ensure the fullAddress is up to date
            addressDetails.fullAddress = this.constructFullAddress(addressDetails);
            console.log("Constructed full address:", addressDetails.fullAddress);

            this.isLoading = false;

            // Add contact info
            addressDetails.shipmentDetails = this.shipmentDetails;

            // Return a new address
            this.$mdDialog.hide(addressDetails);
            console.log("Dialog submission complete");
        } catch (error) {
            this.isLoading = false;
            console.error("Error in submit function:", error);
            console.error("Error occurred with address details:", addressDetails);
            this.toastrService.showErrorToast(
                "Error updating address. Please try again or contact support"
            );
            throw error; // Re-throw to maintain an error chain
        } finally {
            await this.$scope.$applyAsync();
        }
    }

    constructFullAddress(addressDetails: EditAddressDialogViewModel): string {
        return [
            addressDetails.addressLine1,
            addressDetails.addressLine2,
            addressDetails.addressLine3,
            addressDetails.addressLine4,
            addressDetails.addressLine5,
            addressDetails.addressLine6,
            addressDetails.addressLine7,
            addressDetails.addressLine8,
        ]
            .filter((line) => line && line.trim() !== "")
            .join(", ");
    }

    moveMarker(event: google.maps.MapMouseEvent): void {
        if (event.latLng) {
            this.addressDetails.latitude = event.latLng.lat();
            this.addressDetails.longitude = event.latLng.lng();
        }
    }

    markerDragend(event: google.maps.MapMouseEvent) {
        const location = event.latLng;
        if (!location) return;

        try {
            const lat = location.lat();
            const lng = location.lng();

            return this.fetchNearestAddress(lat, lng);
        } catch (error) {
            this.toastrService.showErrorToast(
                "An error occurred while retrieving address information. Please try again or contact support"
            );
        }
    }

    async fetchNearestAddress(lat: number, lng: number): Promise<void> {
        try {
            this.isAddressLoading = true;

            const responseItems = await this.addressLookupService.fetchNearestAddress(lat, lng);

            if (responseItems && responseItems.length > 0) {
                const location = responseItems[0];
                this.selectedAddressId = location.id;
                this.addressDetails.fullAddress = location.address.label;
            }

            this.isAddressLoading = false;

        } catch (error) {
            console.error("Error fetching reverse geocode:", error);

            this.isAddressLoading = false;

            this.toastrService.showErrorToast(
                "An error occurred while retrieving address information. Please try again."
            );
        } finally {
            await this.$scope.$applyAsync();
        }
    }

    placeChanged(place: google.maps.places.PlaceResult): void {
        try {
            if (!place.geometry?.location) {
                this.toastrService.showErrorToast(
                    "An error occurred while retrieving address information. Please try again or contact support"
                );
                return;
            }

            this.addressDetails.latitude = place.geometry.location.lat();
            this.addressDetails.longitude = place.geometry.location.lng();
            this.map?.setCenter(place.geometry.location);
        } catch (error) {
            this.toastrService.showErrorToast(
                "An error occurred while retrieving address information. Please try again or contact support"
            );
        }
    }

    toggleContactCard(): void {
        this.isContactCardExpanded = !this.isContactCardExpanded;
    }

    cancel(): void {
        this.$mdDialog.cancel();
    }

    private handleAddressFieldsFromLookup(
        location: HereMapsLookupResponse
    ): void {
        if (this.useUsFormat) {
            this.handleUsFormatAddressFromLookup(location);
        } else {
            this.handleNonUsFormatAddressFromLookup(location);
        }

        // Update coordinates
        this.addressDetails.latitude = location.position.lat;
        this.addressDetails.longitude = location.position.lng;
    }

    private handleUsFormatAddressFromLookup(
        location: HereMapsLookupResponse
    ): void {
        const address = location.address;

        this.addressDetails.addressLine1 = location.title ||
            location.mapReferences?.pointAddress?.buildingName || "";
        this.addressDetails.addressLine2 = ""; // Unit/Suite - not directly available
        this.addressDetails.addressLine3 = address.houseNumber || "";
        this.addressDetails.addressLine4 = address.street || "";
        this.addressDetails.addressLine5 = address.city || "";
        this.addressDetails.addressLine6 = address.state || "";

        if (address.postalCode) {
            const zipMatch = address.postalCode.match(/^(\d{5})/);
            this.addressDetails.addressLine7 = zipMatch
                ? zipMatch[1]
                : address.postalCode;
        } else {
            this.addressDetails.addressLine7 = "";
        }

        if (address.stateCode) {
            this.addressDetails.stateAbbreviation = address.stateCode;
        } else if (address.state) {
            const stateByName = getStateByName(address.state);
            if (stateByName) {
                this.addressDetails.stateAbbreviation = stateByName.abbreviation;
            }
        }

        if (location.countryInfo) {
            console.log("Country info from lookup:", location.countryInfo);
        }

        if (location.streetInfo && location.streetInfo.length > 0) {
            const streetInfo = location.streetInfo[0];
            console.log("Street info from lookup:", streetInfo);

            let formattedStreet = "";

            if (streetInfo.prefix) {
                formattedStreet += streetInfo.prefix + " ";
            }

            if (streetInfo.streetTypePrecedes && streetInfo.streetType) {
                formattedStreet += streetInfo.streetType + " ";
            }

            formattedStreet += streetInfo.baseName;

            if (!streetInfo.streetTypePrecedes && streetInfo.streetType) {
                formattedStreet += " " + streetInfo.streetType;
            }

            if (streetInfo.suffix) {
                formattedStreet += " " + streetInfo.suffix;
            }

            if (formattedStreet) {
                this.addressDetails.addressLine4 = formattedStreet.trim();
            }
        }
    }

    private handleNonUsFormatAddressFromLookup(
        location: HereMapsLookupResponse
    ): void {
        const address = location.address;
        this.addressDetails.addressLine5 = address.district || address.city || "";
    }

    private validateUsAddress(
        addressDetails: EditAddressDialogViewModel
    ): boolean {
        if (
            !addressDetails.addressLine4 ||
            !addressDetails.addressLine5 ||
            !addressDetails.stateAbbreviation
        ) {
            alert("Please fill in all required fields (Street, City, and State)");
            return false;
        }

        const stateObj = getStateByAbbreviation(
            addressDetails.stateAbbreviation
        );
        if (!stateObj) {
            alert("Please select a valid US state");
            return false;
        }

        return true;
    }
}

export default EditAddressDialogController;
