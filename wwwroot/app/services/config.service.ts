import app from "../app";
import angular from "angular";

class ConfigService {
    static $inject = ["$http"];

    constructor(private $http: angular.IHttpService) {
    }

    async getHereMapsKey(): Promise<string> {
        const response = await this.$http.get<{ apiKey: string }>("/config/GetHereMapsKey");
        return response.data.apiKey;
    }

    async getGoogleMapsKey(): Promise<string> {
        const response = await this.$http.get<{ apiKey: string }>("/config/GetGoogleMapsKey");
        return response.data.apiKey;
    }
}

app.service("configService", ConfigService);
export default ConfigService;
