angular
    .module("uDispatch")
    .factory("DispatchData",
        [
            "$http", function ($http) {
                return {
                    addFollowupEvent: function (jobNo, clientId, contact, staffId, courierId, jobId, jobType, despatcherName) {
                        return $http.post('courier/AddFollowupEvent?jobNo=' + jobNo + '&clientId=' + clientId + '&contact=' + contact + '&staffId=' + staffId + '&courierId=' + courierId + '&jobId=' + jobId + '&jobType=' + jobType + '&despatcherName=' + despatcherName).then(function (response) {
                            return response.data;
                        });
                    },
                    allocateJobs: function (courierId, dispId, jobIds) {
                        return $http.post("job/Allocate?courierId=" + courierId + '&dispId=' + dispId + '&jobIds=' + jobIds).then(function (response) {
                            return response.data;
                        });
                    },
                    getJobs: function () {
                        return $http.get("app/components/home/api/jobsList.php").then(function (response) {
                            return response.data;
                        });

                    },
                    getJobsGrouped: function () {
                        return $http.get("app/components/home/api/jobsGroupedList.json").then(function (response) {
                            return response.data;
                        });

                    },
                    getJobsCurrent: function (courierId, done) {
                        return $http.get("job/current?courierId=" + courierId + '&done=' + done).then(function (response) {
                            return response.data;
                        });

                    },
                    getPotentialCouriers: function () {
                        return $http.get("app/components/home/api/potentialCouriers.json").then(function (response) {
                            return response.data;
                        });

                    },
                    getCouriersPicked: function () {
                        return $http.get("app/components/home/api/couriersPicked.json").then(function (response) {
                            return response.data;
                        });

                    },
                    getCouriersThrough: function () {
                        return $http.get("app/components/home/api/couriersThrough.json").then(function (response) {
                            return response.data;
                        });

                    },
                    getCouriersClear: function () {
                        return $http.get("app/components/home/api/couriersClear.json").then(function (response) {
                            return response.data;
                        });

                    },
                    getAreaList: function () {
                        return $http.get("app/components/home/api/areaList.json").then(function (response) {
                            return response.data;
                        });

                    },
                    getJobUpdates: function () {
                        return $http.get("app/components/home/api/jobUpdates.json").then(function (response) {
                            return response.data;
                        });

                    },
                    getSupports: function () {
                        return $http.get("app/components/home/api/supports.json").then(function (response) {
                            return response.data;
                        });

                    },
                    getLateCalls: function () {
                        return $http.get("app/components/home/api/lateCalls.json").then(function (response) {
                            return response.data;
                        });

                    },
                    getClearLists: function () {
                        return $http.get("courier").then(function (response) {
                            return response.data;
                        });

                    },
                    getActiveCouriers: function () {
                        return $http.get("courier/active").then(function (response) {
                            return response.data;
                        });
                    },
                    getCourierPosition: function (code) {
                        return $http.get("courier/location?code=" + code).then(function (response) {
                            return response.data;
                        });

                    },
                    doAPI: function (data) {
                        return $http.post("app/components/home/api/api.php", data).then(function (response) {
                            return response.data;
                        });


                    },
                    getJobsFilter: function (data) {
                        return $http.get("job?status=" + data.status + "&area=" + data.area + "&order=" + data.order + "&asc=" + data.asc).then(function (response) {
                            return response.data;
                        });


                    }
                };
            }
        ]);   