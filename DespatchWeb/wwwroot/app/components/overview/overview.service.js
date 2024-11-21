class OverviewService {
    constructor($http) {
        this._http = $http;
    }

    async getAllJobs() {
        const response = await this._http.get('/overview');
        return response.data;
    }

    async getAllRegions() {
        const response = await this._http.get('/overview/GetAllRegions');
        return response.data;
    }
}

angular.module('uDispatch').service('overviewService', ['$http', $http => new OverviewService($http)]);
