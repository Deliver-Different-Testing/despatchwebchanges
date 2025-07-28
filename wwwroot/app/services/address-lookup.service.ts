import {HereMapsLocationResult} from "../interfaces/heremaps-autocomplete.interfaces";
import {HereMapsLookupResponse} from "../interfaces/hereMapsLookUp.interfaces";

class AddressLookupService implements angular.IServiceProvider {
    static $inject = [
        "$http"
    ];

    constructor(
        private $http: angular.IHttpService
    ) {
        console.log("AddressLookupService: Service instantiated");
    }

    $get() {
        return this;
    }

    async autocompleteAddressSearch(text: string): Promise<HereMapsLocationResult[]> {
        const response = await this.$http.get<HereMapsLocationResult[]>("addressAutocomplete/AutocompleteAddressSearch", {
            params: {
                text
            }
        });

        return response.data;
    }

    async getLocationDetailsById(addressId: string): Promise<HereMapsLookupResponse> {
        const response = await this.$http.get<HereMapsLookupResponse>("addressAutocomplete/GetLocationDetailsById", {
            params: {
                addressId
            }
        });

        return response.data;
    }

    async fetchNearestAddress(latitude: number, longitude: number): Promise<HereMapsLocationResult[]> {
        const response = await this.$http.get<HereMapsLocationResult[]>("addressAutocomplete/FetchNearestAddress", {
            params: {
                latitude,
                longitude
            }
        });

        return response.data;
    }
}

export default AddressLookupService;
