angular
	.module('udispatch')
	.factory('DispatchData', ['$http', function($http) {
	    return {
	      getJobs: function() {
	        return $http.get('app/components/home/api/jobsList.php').then(function(response) {
	         return response.data;
	        });
			//return "Working :)";
	      },
	      getJobsGrouped: function() {
	        return $http.get('app/components/home/api/jobsGroupedList.json').then(function(response) {
	         return response.data;
	        });
			//return "Working :)";
	      },
	      getJobsCurrent: function() {
	        return $http.get('app/components/home/api/jobsCurrentList.json').then(function(response) {
	         return response.data;
	        });
			//return "Working :)";
	      },
	      getPotentialCouriers: function() {
	        return $http.get('app/components/home/api/potentialCouriers.json').then(function(response) {
	         return response.data;
	        });
			//return "Working :)";
	      },
	      getCouriersPicked: function() {
	        return $http.get('app/components/home/api/couriersPicked.json').then(function(response) {
	         return response.data;
	        });
			//return "Working :)";
	      },
	      getCouriersThrough: function() {
	        return $http.get('app/components/home/api/couriersThrough.json').then(function(response) {
	         return response.data;
	        });
			//return "Working :)";
	      },
	      getCouriersClear: function() {
	        return $http.get('app/components/home/api/couriersClear.json').then(function(response) {
	         return response.data;
	        });
			//return "Working :)";
	      },
	      getAreaList: function() {
	        return $http.get('app/components/home/api/areaList.json').then(function(response) {
	         return response.data;
	        });
			//return "Working :)";
	      },
	      getJobUpdates: function() {
	        return $http.get('app/components/home/api/jobUpdates.json').then(function(response) {
	         return response.data;
	        });
			//return "Working :)";
	      },
	      getSupports: function() {
	        return $http.get('app/components/home/api/supports.json').then(function(response) {
	         return response.data;
	        });
			//return "Working :)";
	      },
	      getLateCalls: function() {
	        return $http.get('app/components/home/api/lateCalls.json').then(function(response) {
	         return response.data;
	        });
			//return "Working :)";
	      },
	      getClearLists: function() {
	        return $http.get('app/components/home/api/clearLists.json').then(function(response) {
	         return response.data;
	        });
			//return "Working :)";
	      },
	      doAPI: function(data) {
	        return $http.post('app/components/home/api/api.php', data).then(function(response) {
	         return response.data;
	        });

			//return "Working :)";
	      },
	      getJobsFilter: function(data) {
	        return $http.post('app/components/home/api/jobsList.php', data).then(function(response) {
	         return response.data;
	        });

			//return "Working :)";
	      }
	    };
  	}])   