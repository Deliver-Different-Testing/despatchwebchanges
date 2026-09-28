import ApiConfig from "../interfaces/apiConfig.interface";
import angular from 'angular';

class ConfigService implements angular.IServiceProvider {
    static $inject = ["$http"];

    constructor(
        private $http: angular.IHttpService
    ) {}

    $get() {
        return this;
    }

    async getHereMapsKey(): Promise<string> {
        const response = await this.$http.get<ApiConfig>("/config/GetHereMapsKey");
        return response.data.apiKey;
    }
}

export default ConfigService;
