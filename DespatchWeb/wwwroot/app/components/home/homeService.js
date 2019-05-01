angular
	.module("uDispatch")
	.factory("DispatchData",
		[
			"$http", function($http) {
				return {
					getJobs: function() {
						return $http.get("app/components/home/api/jobsList.php").then(function(response) {
							return response.data;
						});
						
					},
					getJobsGrouped: function() {
						return $http.get("app/components/home/api/jobsGroupedList.json").then(function(response) {
							return response.data;
						});
						
					},
					getJobsCurrent: function() {
						return $http.get("app/components/home/api/jobsCurrentList.json").then(function(response) {
							return response.data;
						});
						
					},
					getPotentialCouriers: function() {
						return $http.get("app/components/home/api/potentialCouriers.json").then(function(response) {
							return response.data;
						});
						
					},
					getCouriersPicked: function() {
						return $http.get("app/components/home/api/couriersPicked.json").then(function(response) {
							return response.data;
						});
						
					},
					getCouriersThrough: function() {
						return $http.get("app/components/home/api/couriersThrough.json").then(function(response) {
							return response.data;
						});
						
					},
					getCouriersClear: function() {
						return $http.get("app/components/home/api/couriersClear.json").then(function(response) {
							return response.data;
						});
						
					},
					getAreaList: function() {
						return $http.get("app/components/home/api/areaList.json").then(function(response) {
							return response.data;
						});
						
					},
					getJobUpdates: function() {
						return $http.get("app/components/home/api/jobUpdates.json").then(function(response) {
							return response.data;
						});
						
					},
					getSupports: function() {
						return $http.get("app/components/home/api/supports.json").then(function(response) {
							return response.data;
						});
						
					},
					getLateCalls: function() {
						return $http.get("app/components/home/api/lateCalls.json").then(function(response) {
							return response.data;
						});
						
					},
					getClearLists: function() {
						return $http.get("app/components/home/api/clearLists.json").then(function(response) {
							return response.data;
						});
						
					},
					doAPI: function(data) {
						return $http.post("app/components/home/api/api.php", data).then(function(response) {
							return response.data;
						});

						
					},
					getJobsFilter: function(data) {
						return $http.get("app/components/home/api/jobsList.json", data).then(function(response) {
							return response.data;
						});

						
					}
				};
			}
		]);   