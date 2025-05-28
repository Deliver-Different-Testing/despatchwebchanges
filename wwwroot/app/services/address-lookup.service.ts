import ConfigService from "./config.service";
import {HereMapsLocationResult} from "../interfaces/heremaps-autocomplete.interfaces";
import {AppConfig} from "../interfaces/app-config.interface";
import {HereMapsLookupOptions, HereMapsLookupResponse} from "../interfaces/hereMapsLookUp.interfaces";

class AddressLookupService implements angular.IServiceProvider {
    static $inject = [
        "$http",
        "configService",
        "APP_CONFIG",
    ];

    constructor(
        private $http: angular.IHttpService,
        private configService: ConfigService,
        private appConfig: AppConfig,
    ) {
        console.log("AddressLookupService: Service instantiated");
    }

    $get() {
        return this;
    }

    async autocompleteAddressSearch(
        text: string
    ): Promise<HereMapsLocationResult[]> {
        if (!text || text.length < 3) {
            return [];
        }

        const hereMapsKey = await this.configService.getHereMapsKey();

        const response = await this.$http.get<{
            items: HereMapsLocationResult[];
        }>("https://geocode.search.hereapi.com/v1/autosuggest", {
            params: {
                q: text,
                apiKey: hereMapsKey,
                at: this.appConfig.US_Customer ? "37.09024,-95.712891" : "-40.900557,174.885971", // Center points of USA and NZL
                in: `countryCode:${this.appConfig.US_Customer ? "USA" : "NZL"}`,
                limit: 15,
            },
        });

        return response.data.items.filter(item => {
            if (!item || !item.address || !item.address.label || item.address.label.trim() === "")
                return false;

            if (item.resultType) {
                const excludedTypes = ['categoryQuery', 'chainQuery'];
                if (excludedTypes.includes(item.resultType)) return false;
            }

            return true;
        });
    }

    async getLocationDetailsById(
        id: string
    ): Promise<HereMapsLookupResponse | null> {
        const hereMapsKey = await this.configService.getHereMapsKey();

        const options: HereMapsLookupOptions = {
            id: id,
            show: ["countryInfo", "streetInfo"],
        };

        const response = await this.$http.get<HereMapsLookupResponse>(
            "https://lookup.search.hereapi.com/v1/lookup",
            {
                params: {
                    id: options.id,
                    apiKey: hereMapsKey,
                    show: options.show?.join(","),
                }
            }
        );

        return response.data;
    }

    async fetchNearestAddress(lat: number, lng: number): Promise<HereMapsLocationResult[]> {
        const hereMapsKey = await this.configService.getHereMapsKey();

        const response = await this.$http.get<{
            items: HereMapsLocationResult[];
        }>("https://revgeocode.search.hereapi.com/v1/revgeocode", {
            params: {
                at: `${lat},${lng}`,
                apiKey: hereMapsKey,
                limit: 1,
            },
        });

        return response.data.items;
    }
}

export default AddressLookupService;
