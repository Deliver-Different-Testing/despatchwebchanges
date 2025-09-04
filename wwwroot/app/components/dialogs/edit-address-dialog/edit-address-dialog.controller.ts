import "./edit-address-dialog.styles.less";
import {IEditAddressDialogViewModel, IShipmentDetails,} from "../../../interfaces/job.interface";
import BaseController from "../../base-controller";
import ToastrService from "../../../services/toastr.service";
import {AppConfig} from "../../../interfaces/app-config.interface";
import IStateInfo from "../../../interfaces/state-info.interface";
import ConfigService from "../../../services/config.service";
import {HereMapsLocationResult,} from "../../../interfaces/heremaps-autocomplete.interfaces";
import {HereMapsLookupResponse,} from "../../../interfaces/hereMapsLookUp.interfaces";
import {getStateByAbbreviation, getStateByName, getStates} from "../../../functions/usStates";
import AddressLookupService from "../../../services/address-lookup.service";
import {HereMapConfig, HereMapCredentials} from "../../../interfaces/hereMapCredentials.interfaces";

class EditAddressDialogController extends BaseController {
    static $inject = [
        "$scope",
        "$timeout",
        "$interval",
        "$mdDialog",
        "toastrService",
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

    hereMapConfig?: HereMapConfig;
    hereMapCredentials?: HereMapCredentials;
    mapInstance: any;
    platform: any;

    addressSearchText: string;
    usStateList: IStateInfo[];
    addressSearchResults: HereMapsLocationResult[] = [];
    selectedAddressId?: string;

    // Contact Card
    isContactCardExpanded: boolean = false;
    shipmentDetails?: IShipmentDetails;
    private readonly useUsFormat: boolean;

    constructor(
        $scope: angular.IScope,
        $timeout: angular.ITimeoutService,
        $interval: angular.IIntervalService,
        private $mdDialog: angular.material.IDialogService,
        private toastrService: ToastrService,
        private appConfig: AppConfig,
        private configService: ConfigService,
        private addressLookupService: AddressLookupService,
        public addressDetails: IEditAddressDialogViewModel,
        public title: string,
        public submitLabel: string,
        public showContactInfo: boolean,
    ) {
        super();
        this.initServices($timeout, $interval, $scope);

        this.useUsFormat = this.appConfig.US_Customer;
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

        // Set up a map
        this.initializeHereMap();
    }
    
    $onInit() {
        this.registerTimeout(() => {
            if(this.addressDetails.latitude && this.addressDetails.longitude) {
                this.updateMapPosition(this.addressDetails.latitude, this.addressDetails.longitude);
            }
        }, 300);
    }

    private initializeHereMap(): void {
        this.configService.getHereMapsKey()
            .then((hereApiKey) => {
                this.hereMapCredentials = {
                    apiKey: hereApiKey
                };

                // Set up map configuration for a single address
                this.hereMapConfig = {
                    center: {
                        lat: this.addressDetails.latitude || this.appConfig.US_Coordinates_Center.lat,
                        lng: this.addressDetails.longitude ||  this.appConfig.US_Coordinates_Center.lng
                    },
                    zoom: 10,
                    job: {
                        id: 'edit-address',
                        pickup: {
                            lat: this.addressDetails.latitude || 0,
                            lng: this.addressDetails.longitude || 0
                        }
                        // No delivery for a single address
                    },
                    preserveView: false,
                    timestamp: Date.now()
                };
            })
            .catch((error) => {
                console.error('Error initializing HERE Maps:', error);
                this.toastrService.showErrorToast('Error loading map. Please try again.');
            });
    }

    onMapReady(map: any, platform: any): void {
        console.log('HERE Map ready:', map);
        this.mapInstance = map;
        this.platform = platform;

        // Force resize after a short delay to ensure proper sizing
        this.registerTimeout(() => {
            if (this.mapInstance && this.mapInstance.getViewPort) {
                this.mapInstance.getViewPort().resize();
            }
        }, 500);

        // Add click listener for map clicks
        map.addEventListener('tap', async (event: any) => {
            const coord = map.screenToGeo(
                event.currentPointer.viewportX,
                event.currentPointer.viewportY
            );

            await this.onMapClick(coord.lat, coord.lng);
        });
    }

    private async onMapClick(lat: number, lng: number): Promise<void> {
        console.log('Map clicked at:', lat, lng);

        // Update address coordinates
        this.addressDetails.latitude = lat;
        this.addressDetails.longitude = lng;

        this.updateMapPosition(lat, lng);
        await this.fetchNearestAddress(lat, lng);
    }


    private updateMapPosition(lat: number, lng: number): void {
        // Update the map config to reflect the new position
        this.hereMapConfig = {
            ...this.hereMapConfig,
            job: {
                id: 'edit-address',
                pickup: {lat, lng}
            },
            timestamp: Date.now() // Force update
        };

        this.applyScope();
    }

    async autocompleteAddressSearch(
        text: string
    ): Promise<HereMapsLocationResult[]> {
        try {
            const results = await this.addressLookupService.autocompleteAddressSearch(text);
            this.addressSearchResults = results;

            this.applyScope();
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

            let coordinates;
            if (detailedLocation) {
                this.handleAddressFieldsFromLookup(detailedLocation);
                coordinates = {
                    lat: detailedLocation.position.lat,
                    lng: detailedLocation.position.lng
                };
            } else {
                coordinates = {
                    lat: selectedItem.position.lat,
                    lng: selectedItem.position.lng
                };
            }

            // Update address details coordinates
            this.addressDetails.latitude = coordinates.lat;
            this.addressDetails.longitude = coordinates.lng;
            this.addressDetails.fullAddress = selectedItem.address.label;

            // Update map to show new location
            this.updateMapPosition(coordinates.lat, coordinates.lng);

            this.isAddressLoading = false;

        } catch (error: any) {
            console.error("Error processing selected address:", error);
            this.isAddressLoading = false;
            this.toastrService.showErrorToast(
                "An error occurred while processing the selected address. Please try again."
            );
        } finally {
            this.applyScope();
        }
    }

    constructFullAddress(addressDetails: IEditAddressDialogViewModel): string {
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

    async fetchNearestAddress(lat: number, lng: number): Promise<void> {
        try {
            this.isAddressLoading = true;

            const responseItems = await this.addressLookupService.fetchNearestAddress(lat, lng);

            if (responseItems && responseItems.length > 0) {
                const location = responseItems[0];
                this.selectedAddressId = location.id;
                this.addressDetails.fullAddress = location.address.label;

                // Update the search text to show the new address
                this.addressSearchText = location.address.label;

                // Update address fields from lookup
                if (location.id) {
                    const detailedLocation = await this.addressLookupService.getLocationDetailsById(location.id);
                    if (detailedLocation) {
                        this.handleAddressFieldsFromLookup(detailedLocation);
                    }
                }
            }

            this.isAddressLoading = false;

        } catch (error) {
            console.error("Error fetching reverse geocode:", error);
            this.isAddressLoading = false;
            this.toastrService.showErrorToast(
                "An error occurred while retrieving address information. Please try again."
            );
        } finally {
            this.applyScope();
        }
    }

    toggleContactCard(): void {
        this.isContactCardExpanded = !this.isContactCardExpanded;
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
        addressDetails: IEditAddressDialogViewModel
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

    async submit(addressDetails: IEditAddressDialogViewModel): Promise<void> {
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
            this.applyScope();
        }
    }

    cancel(): void {
        this.$mdDialog.cancel();
    }

}

export default EditAddressDialogController;
