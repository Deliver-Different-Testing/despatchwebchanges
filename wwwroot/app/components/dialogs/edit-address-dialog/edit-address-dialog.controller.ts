import {
  ShipmentDetails,
  EditAddressDialogViewModel,
} from "../../../interfaces/job.interface";
import BaseController from "../../base-controller";
import DispatchCoreService from "../../../services/dispatch-core.service";
import ToastrService from "../../../services/toastr.service";
import { AppConfig } from "../../../interfaces/app-config.interface";
import UsStatesService from "../../../services/getUsStates.service";
import IStateInfo from "../../../interfaces/state-info.interface";
import ConfigService from "../../../services/config.service";

class EditAddressDialogController extends BaseController {
  static $inject = [
    "$scope",
    "$timeout",
    "$interval",
    "$mdDialog",
    "DispatchData",
    "toastrService",
    "NgMap",
    "APP_CONFIG",
    "UsStatesService",
    "configService",
    "addressDetails",
    "title",
    "submitLabel",
    "showContactInfo",
  ];

  private readonly useUsFormat: boolean;

  isLoading: boolean;
  addressSearchText: string;
  googleMapsUrl?: string;
  mapDisplay?: boolean;
  map?: google.maps.Map;
  marker?: google.maps.Marker;
  usStateList: IStateInfo[];

  // Contact Card
  isContactCardExpanded: boolean;
  shipmentDetails?: ShipmentDetails;

  constructor(
    private $scope: angular.IScope,
    $timeout: angular.ITimeoutService,
    $interval: angular.IIntervalService,
    private $mdDialog: angular.material.IDialogService,
    private DispatchData: DispatchCoreService,
    private toastrService: ToastrService,
    private NgMap: angular.map.INgMap,
    appConfig: AppConfig,
    private UsStatesService: UsStatesService,
    private configService: ConfigService,
    public addressDetails: EditAddressDialogViewModel,
    public title: string,
    public submitLabel: string,
    public showContactInfo: boolean
  ) {
    super();
    this.initServices($timeout, $interval);

    this.isLoading = false;
    this.useUsFormat = appConfig.US_Customer;
    this.addressSearchText = this.addressDetails.fullAddress || "";
    this.isContactCardExpanded = false;

    this.usStateList = this.UsStatesService.getStates();
    if (
      this.addressDetails.addressLine6 &&
      !this.addressDetails.stateAbbreviation
    ) {
      const stateByName = this.UsStatesService.getStateByName(
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
          return this.NgMap.getMap({ id: "dispatchMap" });
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

        console.log("Marker initialized:", this.marker);

        this.addressSearchAutocomplete(this.addressDetails.fullAddress).then(
          (_) => console.log("Address Search Complete!")
        );
      });
  }


  private transformSuggestions(data: any): Array<{ id: string; text: string }> {
    return data.suggestions.map((obj: any) => ({
      id: obj.locationId,
      text: obj.label.split(", ").reverse().join(", "),
    }));
  }

  async addressSearchAutocomplete(searchText: string) {
    try {
      const suggestions = await this.DispatchData.autocompleteAddressSearch(
        searchText
      );
      return this.transformSuggestions(suggestions);
    } catch (error: any) {
      this.toastrService.showErrorToast(error.message);
    }
  }

  async addressSearchItemSelected(item: any) {
    try {
      const data: any = await this.DispatchData.getGeoCodeInformation(item);
      const returnedLocation = data.Response.View[0].Result[0].Location;

      console.log(`Suburb/City = ${returnedLocation.Address.District}`);
      console.log(`PostCode/ZIP = ${returnedLocation.Address.PostalCode}`);

      this.handleUsFormatAddress(returnedLocation);
      this.updateAddressDetails(returnedLocation);
      this.updateMapMarker(returnedLocation);
    } catch (error) {
      console.log("Error: ", error);
    }
  }

  private handleUsFormatAddress(returnedLocation: any): void {
    this.addressDetails.addressLine1 = returnedLocation.Address.Place;
    this.addressDetails.addressLine2 = returnedLocation.Address.Subunit;
    this.addressDetails.addressLine3 = returnedLocation.Address.HouseNumber;
    this.addressDetails.addressLine4 = returnedLocation.Address.Street;
    this.addressDetails.addressLine5 = returnedLocation.Address.City;
    this.addressDetails.addressLine6 = returnedLocation.Address.State;
    this.addressDetails.addressLine7 = returnedLocation.Address.PostalCode;

    const selectedState = this.UsStatesService.getStateByAbbreviation(
      returnedLocation.Address.State
    );
    if (selectedState) {
      this.addressDetails.stateAbbreviation = selectedState.abbreviation;
    }
  }

  private updateAddressDetails(returnedLocation: any): void {
    this.addressDetails.latitude = returnedLocation.DisplayPosition.Latitude;
    this.addressDetails.longitude = returnedLocation.DisplayPosition.Longitude;
    this.addressDetails.fullAddress = returnedLocation.Address.Label;
  }

  updateMapMarker(returnedLocation: any): void {
    const latLng = new google.maps.LatLng(
      returnedLocation.DisplayPosition.Latitude,
      returnedLocation.DisplayPosition.Longitude
    );

    console.log("Setting map center to:", latLng.toString());
    this.map?.setCenter(latLng);

    console.log("Marker before setPosition:", this.marker);
    this.marker?.setPosition(latLng);
    console.log("Marker after setPosition:", this.marker);

    this.marker?.setVisible(true);
  }

  async submit(addressDetails: EditAddressDialogViewModel): Promise<void> {
    console.log("Starting submit with address details:", addressDetails);
    this.isLoading = true;

    try {
      console.log("Using US Format:", this.useUsFormat);

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

      const stateObj = this.UsStatesService.getStateByAbbreviation(
        addressDetails.stateAbbreviation
      );
      console.log("Retrieved state object:", stateObj);

      addressDetails.addressLine6 = stateObj?.name ?? "";
      console.log(
        "Updated address details with full state name:",
        addressDetails
      );

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
    }
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

    const stateObj = this.UsStatesService.getStateByAbbreviation(
      addressDetails.stateAbbreviation
    );
    if (!stateObj) {
      alert("Please select a valid US state");
      return false;
    }

    return true;
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
      this.$scope.$apply();
    }
  }

  markerDragend(event: google.maps.MapMouseEvent): void {
    // Get the marker's new position
    const location = event.latLng;
    if (!location) return;

    try {
      this.DispatchData.retrieveAddresses(location.lat(), location.lng()).then(
        (data: any) => {
          const returnedLocation = data.Response.View[0].Result[0].Location;

          // Updating scope variables with new data
          this.addressDetails.address = returnedLocation.Address.Label;
          this.addressDetails.latitude =
            returnedLocation.DisplayPosition.Latitude;
          this.addressDetails.longitude =
            returnedLocation.DisplayPosition.Longitude;

          // Log output
          console.log(`Suburb = ${returnedLocation.Address.District}`);
          console.log(`PostCode = ${returnedLocation.Address.PostalCode}`);
        }
      );
    } catch (error) {
      this.toastrService.showErrorToast(
        "An error occurred while retrieving address information. Please try again or contact support"
      );
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
}

export default EditAddressDialogController;
