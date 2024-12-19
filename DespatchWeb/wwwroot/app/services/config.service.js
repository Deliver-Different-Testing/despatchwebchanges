/**
 * @class ConfigService
 * @description Service to handle api calls to get configurations
 */
class ConfigService {
    static $inject = ['$http'];

    constructor($http) {
        this.$http = $http;
    }

    async getHereMapsKey() {
        const response = await this.$http.get('/config/GetHereMapsKey');
        return response.data.apiKey;
    }

    async getGoogleMapsKey() {
        const response = await this.$http.get('/config/GetGoogleMapsKey');
        return response.data.apiKey;
    }
}

angular.module("uDispatch").service("configService", [
    '$http', ($http) => new ConfigService($http)
]);
