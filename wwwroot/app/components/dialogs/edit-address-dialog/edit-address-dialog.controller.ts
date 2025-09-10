import "./edit-address-dialog.styles.less";
import {IEditAddressDialogViewModel, IShipmentDetails,} from "../../../interfaces/job.interface";
import BaseController from "../../base-controller";
import ToastrService from "../../../services/toastr.service";
import {IAppConfig} from "../../../interfaces/app-config.interface";
import IStateInfo from "../../../interfaces/state-info.interface";
import ConfigService from "../../../services/config.service";
import {IHereMapsLocationResult,} from "../../../interfaces/heremaps-autocomplete.interfaces";
import {HereMapsLookupResponse,} from "../../../interfaces/hereMapsLookUp.interfaces";
import {getStateByAbbreviation, getStateByName, getStates} from "../../../functions/usStates";
import AddressLookupService from "../../../services/address-lookup.service";
import {HereMapConfig, HereMapCredentials} from "../../../interfaces/hereMapCredentials.interfaces";
import dayjs from "dayjs";

class EditAddressDialogController extends BaseController {
    static $inject = [
        "$scope",
        "$timeout",
        "$interval",
        "$log",
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
    addressSearchResults: IHereMapsLocationResult[] = [];
    selectedAddressId?: string;

    // Contact Card
    isContactCardExpanded: boolean = false;
    shipmentDetails?: IShipmentDetails;
    useUsFormat: boolean;

    constructor(
        $scope: angular.IScope,
        $timeout: angular.ITimeoutService,
        $interval: angular.IIntervalService,
        private $log: angular.ILogService,
        private $mdDialog: angular.material.IDialogService,
        private toastrService: ToastrService,
        private appConfig: IAppConfig,
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

        // Handle state abbreviation for US addresses
        if (this.useUsFormat && this.addressDetails.addressLine6) {
            // Check if it's already an abbreviation
            if (this.addressDetails.addressLine6.length === 2) {
                // It's likely already an abbreviation
                this.addressDetails.stateAbbreviation = this.addressDetails.addressLine6;
            } else {
                // Try to find the state by name and get its abbreviation
                const stateByName = getStateByName(this.addressDetails.addressLine6);
                if (stateByName) {
                    this.addressDetails.stateAbbreviation = stateByName.abbreviation;
                }
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
                    timestamp: dayjs().valueOf()
                };
            })
            .catch((error) => {
                this.$log.error('Error initializing HERE Maps:', error);
                this.toastrService.showErrorToast('Error loading map. Please try again.');
            });
    }

    onMapReady(map: any, platform: any): void {
        this.$log.debug('HERE Map ready:', map);
        this.mapInstance = map;
        this.platform = platform;

        // Force resize after a short delay to ensure proper sizing
        this.registerTimeout(() => {
            if (this.mapInstance && this.mapInstance.getViewPort) {
                this.mapInstance.getViewPort().resize();
            }
        }, 100);

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
        this.$log.debug('Map clicked at:', lat, lng);

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
            timestamp: dayjs().valueOf()
        };

        this.applyScope();
    }

    async autocompleteAddressSearch(
        text: string
    ): Promise<IHereMapsLocationResult[]> {
        try {
            const results = await this.addressLookupService.autocompleteAddressSearch(text);
            this.addressSearchResults = results;

            this.applyScope();
            return results;
        } catch (error: any) {
            this.toastrService.showErrorToast(
                error.message || "Error searching for addresses"
            );
            this.$log.error("Error in autocompleteAddressSearch:", error);
            return [];
        }
    }

    async addressSearchItemSelected(
        selectedItem: IHereMapsLocationResult
    ): Promise<void> {
        try {
            this.$log.debug("Selected address item:", selectedItem);

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
        } catch (error) {
            this.$log.error("Error processing selected address:", error);
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
            this.$log.error("Error fetching reverse geocode:", error);
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
        const address = location.address;

        // Common fields for both US and NZ
        // Line 1: Company/Building
        this.addressDetails.addressLine1 = location.title ||
            location.mapReferences?.pointAddress?.buildingName || "";

        // Line 2: Unit/Suite - not directly available from HERE Maps
        this.addressDetails.addressLine2 = "";

        // Line 3: Street Number
        this.addressDetails.addressLine3 = address.houseNumber || "";

        // Line 4: Street Name
        if (location.streetInfo && location.streetInfo.length > 0) {
            const streetInfo = location.streetInfo[0];
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

            this.addressDetails.addressLine4 = formattedStreet.trim();
        } else {
            this.addressDetails.addressLine4 = address.street || "";
        }

        if (this.useUsFormat) {
            // US Format specific fields
            // Line 5: City
            this.addressDetails.addressLine5 = address.city || "";

            // Line 6: State
            this.addressDetails.addressLine6 = address.stateCode || address.state || "";

            // Handle state abbreviation
            if (address.stateCode) {
                this.addressDetails.stateAbbreviation = address.stateCode;
            } else if (address.state) {
                const stateByName = getStateByName(address.state);
                if (stateByName) {
                    this.addressDetails.stateAbbreviation = stateByName.abbreviation;
                    this.addressDetails.addressLine6 = stateByName.abbreviation;
                }
            }

            // Line 7: ZIP Code
            if (address.postalCode) {
                const zipMatch = address.postalCode.match(/^(\d{5})/);
                this.addressDetails.addressLine7 = zipMatch
                    ? zipMatch[1]
                    : address.postalCode;
            } else {
                this.addressDetails.addressLine7 = "";
            }
        } else {
            // NZ Format specific fields
            // Line 5: Suburb
            this.addressDetails.addressLine5 = address.district || "";

            // Line 6: City
            this.addressDetails.addressLine6 = address.city || "";

            // Line 7: Post Code
            this.addressDetails.addressLine7 = address.postalCode || "";
        }

        // Line 8: Additional notes/extras - typically empty from lookup
        this.addressDetails.addressLine8 = "";

        // Update coordinates
        this.addressDetails.latitude = location.position.lat;
        this.addressDetails.longitude = location.position.lng;
    }

    private validateAddress(
        addressDetails: IEditAddressDialogViewModel
    ): boolean {
        // Common validation for both formats
        if (!addressDetails.addressLine1) {
            alert("Please enter a Company/Building/Complex name");
            return false;
        }

        if (!addressDetails.addressLine4) {
            alert("Please enter a street name");
            return false;
        }

        if (this.useUsFormat) {
            // US specific validation
            if (!addressDetails.addressLine5) {
                alert("Please enter a city");
                return false;
            }

            if (!addressDetails.addressLine6 || !addressDetails.stateAbbreviation) {
                alert("Please select a state");
                return false;
            }

            const stateObj = getStateByAbbreviation(
                addressDetails.stateAbbreviation
            );
            if (!stateObj) {
                alert("Please select a valid US state");
                return false;
            }

            if (!addressDetails.addressLine7) {
                alert("Please enter a ZIP code");
                return false;
            }
        } else {
            // NZ specific validation
            if (!addressDetails.addressLine6) {
                alert("Please enter a city");
                return false;
            }

            if (!addressDetails.addressLine7) {
                alert("Please enter a post code");
                return false;
            }
        }

        return true;
    }

    async submit(addressDetails: IEditAddressDialogViewModel): Promise<void> {
        this.$log.debug("Starting submit with address details:", addressDetails);
        this.isLoading = true;

        try {
            this.$log.debug("Using US Format:", this.useUsFormat);

            // Validate the address
            if (!this.validateAddress(addressDetails)) {
                this.$log.error("Address validation failed");
                this.isLoading = false;
                return;
            }

            if (this.useUsFormat) {
                // For US addresses, ensure Line 6 has the abbreviation
                if (addressDetails.stateAbbreviation) {
                    addressDetails.addressLine6 = addressDetails.stateAbbreviation;
                }
            }

            // Ensure the fullAddress is up to date
            addressDetails.fullAddress = this.constructFullAddress(addressDetails);
            this.$log.debug("Constructed full address:", addressDetails.fullAddress);

            this.isLoading = false;

            // Add contact info if available
            addressDetails.shipmentDetails = this.shipmentDetails;

            // Return the updated address
            this.$mdDialog.hide(addressDetails);
            this.$log.debug("Dialog submission complete");
        } catch (error) {
            this.isLoading = false;
            this.$log.error("Error in submit function:", error);
            this.$log.error("Error occurred with address details:", addressDetails);
            this.toastrService.showErrorToast(
                "Error updating address. Please try again or contact support"
            );
            throw error;
        } finally {
            this.applyScope();
        }
    }

    cancel(): void {
        this.$mdDialog.cancel();
    }
}

export default EditAddressDialogController;