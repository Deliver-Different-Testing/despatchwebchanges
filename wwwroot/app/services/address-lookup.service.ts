import {IHereMapsLocationResult} from "../interfaces/heremaps-autocomplete.interfaces";
import {HereMapsLookupResponse} from "../interfaces/hereMapsLookUp.interfaces";
import angular from 'angular';

class AddressLookupService implements angular.IServiceProvider {
    static $inject = [
        "$http"
    ];

    constructor(
        private $http: angular.IHttpService
    ) {}

    $get() {
        return this;
    }

    async autocompleteAddressSearch(text: string): Promise<IHereMapsLocationResult[]> {
        const response = await this.$http.get<IHereMapsLocationResult[]>("addressAutocomplete/AutocompleteAddressSearch", {
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

    async fetchNearestAddress(latitude: number, longitude: number): Promise<IHereMapsLocationResult[]> {
        const response = await this.$http.get<IHereMapsLocationResult[]>("addressAutocomplete/FetchNearestAddress", {
            params: {
                latitude,
                longitude
            }
        });

        return response.data;
    }
}

export default AddressLookupService;
