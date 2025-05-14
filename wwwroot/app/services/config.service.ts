import ApiConfig from "../interfaces/apiConfig.interface";
import HereMapsAppConfig from "../interfaces/hereMapsAppConfig";

class ConfigService implements angular.IServiceProvider {
    static $inject = ["$http"];

    constructor(
        private $http: angular.IHttpService
    ) {
        console.log("Config service initialized");
    }

    $get() {
        return this;
    }

    async getHubUrl(): Promise<string> {
        const response = await this.$http.get<string>("/config/GetHubUrl");
        return response.data;
    }

    async getHereMapsKey(): Promise<string> {
        const response = await this.$http.get<ApiConfig>("/config/GetHereMapsKey");
        return response.data.apiKey;
    }

    async getHereMapsConfig(): Promise<HereMapsAppConfig> {
        const response = await this.$http.get<HereMapsAppConfig>("/config/GetHereMapsConfig");
        return response.data;
    }

    async getGoogleMapsKey(): Promise<string> {
        const response = await this.$http.get<ApiConfig>("/config/GetGoogleMapsKey");
        return response.data.apiKey;
    }
}

export default ConfigService;
