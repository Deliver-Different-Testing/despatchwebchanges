import app from "../app";

/**
 * @typedef {Object} ConfigApiKeyResponse
 * @property {string} apiKey - The API key from the configuration
 */

/**
 * Service for retrieving various API keys from configuration
 */
class ConfigService {
    static $inject = ["$http"];

    /**
     * @param $http - Angular's $http service
     */
    constructor($http) {
        this.$http = $http;
    }

    /**
     * Retrieves the HERE Maps API key from configuration
     * @returns {Promise<string>} The HERE Maps API key
     */
    async getHereMapsKey() {
        const response = await this.$http.get("/config/GetHereMapsKey");
        return response.data.apiKey;
    }

    /**
     * Retrieves the Google Maps API key from configuration
     * @returns {Promise<string>} The Google Maps API key
     */
    async getGoogleMapsKey() {
        const response = await this.$http.get("/config/GetGoogleMapsKey");
        return response.data.apiKey;
    }
}

app.service("configService", ConfigService);
