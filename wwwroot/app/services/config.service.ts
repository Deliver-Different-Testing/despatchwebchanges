import ApiConfig from "../interfaces/apiConfig.interface";

class ConfigService implements angular.IServiceProvider {
    static $inject = ["$http"];

    constructor(private $http: angular.IHttpService) {
        console.log("Config service initialized");
    }

    $get() {
        return this;
    }

    async getHereMapsKey(): Promise<string> {
        const response = await this.$http.get<ApiConfig>("/config/GetHereMapsKey");
        return response.data.apiKey;
    }

    async getGoogleMapsKey(): Promise<string> {
        const response = await this.$http.get<ApiConfig>("/config/GetGoogleMapsKey");
        return response.data.apiKey;
    }
}

export default ConfigService;
