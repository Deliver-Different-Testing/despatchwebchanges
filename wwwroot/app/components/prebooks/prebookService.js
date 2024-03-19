angular
    .module('uDispatch')
    .factory('uPBData', ['$http', function ($http) {
        return {


            getPreBookJobs: function () {
                return $http.get('/Job/PreBookJobs').then(function (response) {
                    return response.data;
                });
            },
            sendPrebookJob: function (jobId) {
                return $http.post('/Job/SendPrebookJob?jobId=' + jobId).then(function (response) {
                    return response.data;
                });
            },
            voidPrebookJob: function (jobId, despatcherName, staffId) {
                return $http.post('/Job/VoidPrebookJob?jobId=' + jobId + '&despatcher=' + despatcherName + '&staffId=' + staffId).then(function (response) {
                    return response.data;
                });
            },

            getJobDetail: function (id) {
                return $http.get('/Job/PreBookDetail?preBookJobId=' + id).then(function (response) {
                    return response.data;
                });
            },
            getBulkJobPhoto: function (bulkJobId) {
                return $http.get('/CS/GetBulkJobPhoto?bulkJobId=' + bulkJobId).then(function (response) {
                    return response.data;
                });
            }
            
        };
    }]);   