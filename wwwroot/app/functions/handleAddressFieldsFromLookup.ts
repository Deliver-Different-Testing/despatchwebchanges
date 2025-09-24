import {HereMapsLookupResponse} from "../interfaces/hereMapsLookUp.interfaces";
import {getStateByName} from "./usStates";
import {IEditAddressDialogViewModel} from "../interfaces/job.interface";

function handleAddressFieldsFromLookup(location: HereMapsLookupResponse, addressDetails: IEditAddressDialogViewModel, useUsFormat: boolean = false) {
    const address = location.address;

    // Common fields for both US and NZ
    // Line 1: Company/Building
    addressDetails.addressLine1 = location.title ||
        location.mapReferences?.pointAddress?.buildingName || "";

    // Line 2: Unit/Suite - not directly available from HERE Maps
    addressDetails.addressLine2 = "";

    // Line 3: Street Number
    addressDetails.addressLine3 = address.houseNumber || "";

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

        addressDetails.addressLine4 = formattedStreet.trim();
    } else {
        addressDetails.addressLine4 = address.street || "";
    }

    if (useUsFormat) {
        // US Format specific fields
        // Line 5: City
        addressDetails.addressLine5 = address.city || "";

        // Line 6: State
        addressDetails.addressLine6 = address.stateCode || address.state || "";

        // Handle state abbreviation
        if (address.stateCode) {
            addressDetails.stateAbbreviation = address.stateCode;
        } else if (address.state) {
            const stateByName = getStateByName(address.state);
            if (stateByName) {
                addressDetails.stateAbbreviation = stateByName.abbreviation;
                addressDetails.addressLine6 = stateByName.abbreviation;
            }
        }

        // Line 7: ZIP Code
        if (address.postalCode) {
            const zipMatch = address.postalCode.match(/^(\d{5})/);
            addressDetails.addressLine7 = zipMatch
                ? zipMatch[1]
                : address.postalCode;
        } else {
            addressDetails.addressLine7 = "";
        }
    } else {
        // NZ Format specific fields
        // Line 5: Suburb
        addressDetails.addressLine5 = address.district || "";

        // Line 6: City
        addressDetails.addressLine6 = address.city || "";

        // Line 7: Post Code
        addressDetails.addressLine7 = address.postalCode || "";
    }

    // Line 8: Additional notes/extras - typically empty from lookup
    addressDetails.addressLine8 = "";

    // Update coordinates
    addressDetails.latitude = location.position.lat;
    addressDetails.longitude = location.position.lng;

    return addressDetails;
}

export default handleAddressFieldsFromLookup;