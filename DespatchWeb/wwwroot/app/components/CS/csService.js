angular
    .module('uDispatch')
    .factory('uCSData', ['$http', function ($http) {
        return {
            allocateJobs: function (courierId, dispId, jobIds) {
                return $http.post("job/Allocate?courierId=" + courierId + "&dispId=" + dispId + "&jobIds=" + jobIds).then(function (response) {
                    return response;
                });
            },
            addRestoreEvent: function (jobNo, clientId, contact, staffId, courierId, jobId, jobType, despatcherName) {
                return $http.post("job/AddRestoreEvent?jobNo=" + jobNo + "&clientId=" + clientId + "&contact=" + contact + "&staffId=" + staffId + "&courierId=" + courierId + "&jobId=" + jobId + "&jobType=" + jobType + "&despatcherName=" + despatcherName).then(function (response) {
                    return response.data;
                });
            },
            getPodJobs: function (courierId, clientId, wild, job, fromDate, toDate, pageIndex, pageSize) {
                return $http.get('/Job/PODSearch?courierId=' + courierId + '&clientId=' + clientId + '&wild=' + wild + '&job=' + job + '&fromDate=' + fromDate.toISOString() + '&toDate=' + toDate.toISOString() + '&pageIndex=' + pageIndex + "&pageSize=" + pageSize).then(function (response) {
                    return response.data;
                });
            },

            searchBulkJobs: function (courierId, clientId, job, wild, fromDate, toDate, pageIndex, pageSize) {
                return $http.get('/Job/BulkSearch?courierId=' + courierId + '&clientId=' + clientId + '&job=' + job + '&wild=' + wild + '&fromDate=' + fromDate.toISOString() + '&toDate=' + toDate.toISOString() + '&pageIndex=' + pageIndex + "&pageSize=" + pageSize).then(function (response) {
                    return response.data;
                });
            },

            searchPreBookJobs: function (courierId, clientId, wild, job, fromDate, toDate, pageIndex, pageSize) {
                return $http.get('/Job/PreBookSearch?courierId=' + courierId + '&clientId=' + clientId + '&wild=' + wild + '&job=' + job + '&fromDate=' + fromDate.toISOString() + '&toDate=' + toDate.toISOString() + '&pageIndex=' + pageIndex + "&pageSize=" + pageSize).then(function (response) {
                    return response.data;
                });
            },
            getCourierRoute: function (code, start, end) {
                return $http.get('/courier/route?code=' + code + '&start=' + start.format("YYYY-MM-DDTHH:mm:ss") + '&end=' + end.format("YYYY-MM-DDTHH:mm:ss")).then(function (response) {
                    return response.data;
                });
            },
            getJobDetail: function (id) {
                return $http.get('/Job/Detail?jobId=' + id).then(function (response) {
                    return response.data;
                });
            },
            getRelatedJobs: function (id, clientId) {
                return $http.get('/Job/Related?parentId=' + id + '&clientId=' + clientId).then(function (response) {
                    return response.data;
                });
            },
            getScanDetail: function (runDate, scan) {
                return $http.get('/Job/ScanJobDetail?runDate=' + runDate.toISOString() + '&scan=' + scan).then(function (response) {
                    return response.data;
                });
            },
            getPreBookDetail: function (id) {
                return $http.get('/Job/PreBookDetail?preBookJobId=' + id).then(function (response) {
                    return response.data;
                });
            },
            getBulkJobDetail: function (id) {
                return $http.get('/Job/BulkDetail?bulkJobId=' + id).then(function (response) {
                    return response.data;
                });
            },
            getBulkJobPhoto: function (bulkJobId) {
                return $http.get('/CS/GetBulkJobPhoto?bulkJobId=' + bulkJobId).then(function (response) {
                    return response.data;
                });
            },
            getActiveCouriers: function () {
                return $http.get("courier/active").then(function (response) {
                    return response.data;
                });
            },
            getAllCouriers: function () {
                return $http.get("courier/AllActive").then(function (response) {
                    return response.data;
                });
            },
            addEventNote: function (eventId, note) {
                return $http.post('CS/AddEventNote?eventId=' + eventId + '&note=' + note + '&userName=' + ClientName).then(function (response) {
                    return response.data;
                });
            },
            validateSwapPOD: function (jobNumber) {
                return $http.post('Job/ValidateSwapPOD?job=' + jobNumber).then(function (response) {
                    return response.data;
                });
            },
            restoreJobs: function (courierId, dispId, jobIds) {
                return $http.post("job/RestoreJobs?courierId=" + courierId + "&dispId=" + dispId + "&jobIds=" + jobIds).then(function (response) {
                    return response.data;
                });
            },
            restoreSplitJobs: function (courierId, dispId, jobIds) {
                return $http.post("job/RestoreSplitJobs?courierId=" + courierId + "&dispId=" + dispId + "&jobIds=" + jobIds).then(function (response) {
                    return response.data;
                });
            },
            swapPOD: function (job1, job2) {
                return $http.post('Job/SwapPOD?job1=' + job1 + '&job2=' + job2).then(function (response) {
                    return response.data;
                });
            },
            closeEvent: function (eventId, userName) {
                return $http.post('CS/CloseEvent?eventId=' + eventId + '&userName=' + `${ClientName}-${userName}`).then(function (response) {
                    return response.data;
                });
            },
            reSendJobs: function (jobIds) {
                return $http.post("job/ReSendSelected?jobIds=" + jobIds).then(function (response) {
                    return response.data;
                });
            },
            reAssignJobs: function (jobIds) {
                return $http.post("job/ReAssignSelected?jobIds=" + jobIds).then(function (response) {
                    return response.data;
                });
            },
            sendPOD: function (jobId, email) {
                return $http.get('job/SendPOD?jobId=' + jobId + '&toEmail=' + email).then(function (response) {
                    return response.data;
                });
            },
            unSplitJob: function (jobId) {
                return $http.post('job/UnSplitJob?jobId=' + jobId).then(function (response) {
                    return response.data;
                });
            },
            generateDirectLink: function (eventId, clientId) {
                return $http.get('/CS/GenerateDirectLink?eventId=' + eventId + '&clientId=' + clientId).then(function (response) {
                    return response.data;
                });
            },
            createEvent: function (data, notify) {
                return $http({
                    url: 'book/CreateEvent?clientInternal=' + ClientInternal + '&notify=' + notify + '&clientName=' + ClientName,
                    method: "POST",
                    data: data
                }).then(function (response) {
                    return response.data;
                }).catch(function (response) {
                    console.error('Book/CreateEvent error', response.status, response.data);
                });
            },
            getActiveClients: function(searchTerm) {
                return $http.get('/home/ActiveClients?searchTerm=' + searchTerm)
                    .then(function(response) {
                        return response.data;
                    });
            },
            getActiveCouriersSearch: function(searchTerm) {
                return $http.get('/courier/AllActiveSearch?searchTerm=' + searchTerm)
                    .then(function(response) {
                        return response.data;
                    });
            },
            doAPI: function (path, data) {
                return $http.post(path, data).then(function (response) {
                    return response.data;
                });
            }
        };
    }]);
