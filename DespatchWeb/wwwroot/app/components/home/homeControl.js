angular
	.module('udispatch')
	.controller('HomeControl', ['$scope', 'DispatchData', "$state", "$filter", '$parse',"hotkeys", function($scope, DispatchData, $state, $filter, $parse, hotkeys) {

		$scope.gather = {
			submit: function() {
				$scope.gather.form.onSubmit();
				$(".gatherForm").hide();

			},
			cancel: function() {
				$(".gatherForm").hide();
			},
			showForm: function() {
				$(".gatherForm").show(0, function() {
					setTimeout(function(){ $(".gatherForm .focusMe").focus(); }, 100);
				});
			},
			submitValue: "Save"
		}

		$scope.options = {
			"detail": {
				"size": [
					{
						"id": 1,
						"label":"Car"
					},
					{
						"id": 2,
						"label":"Bike"
					},
					{
						"id": 3,
						"label":"Truck"
					},
					{
						"id": 4,
						"label":"Van"
					}
				]
			}
		}




		$scope.boxes = {
			"jobsList": {
				"title":"Jobs List",
				"tpl":"app/components/home/tpls/jobList.tpl",
				"showSearch": 1
			},
			"jobDetail": {
				"title":"Detail",
				"tpl":"app/components/home/tpls/jobDetail.tpl",
				"showSearch": 0,
				"showDetailButtons": 1
			},
			"potentialCouriers": {
				"title":"Potential Couriers",
				"tpl":"app/components/home/tpls/potentialCouriers.tpl",
				"showSearch": 1
			},
			"jobGroups": {
				"title":"Grouped Jobs",
				"tpl":"app/components/home/tpls/jobGroups.tpl",
				"showSearch": 1
			},
			"currentWork": {
				"title":"Current Work",
				"tpl":"app/components/home/tpls/currentWork.tpl",
				"showSearch": 1
			},
			"couriersMoveThrough": {
				"title":"Couriers Movement Through List",
				"tpl":"app/components/home/tpls/couriersMovementThroughList.tpl",
				"showSearch": 1
			},
			"courierMovePickedUp": {
				"title":"Couriers Movement Picked Up Run",
				"tpl":"app/components/home/tpls/couriersMovementPickedUp.tpl",
				"showSearch": 1
			},
			"courierMoveClear": {
				"title":"Couriers Movement Clear List",
				"tpl":"app/components/home/tpls/couriersMovementClearList.tpl",
				"showSearch": 1
			},
			"areaList": {
				"title":"Area List",
				"tpl":"app/components/home/tpls/areaList.tpl",
				"showSearch": 0
			},
			"jobUpdates": {
				"title":"Job Updates",
				"tpl":"app/components/home/tpls/jobUpdates.tpl",
				"showSearch": 0
			},
			"supports": {
				"title":"Supports",
				"tpl":"app/components/home/tpls/supports.tpl",
				"showSearch": 0
			},
			"lateCalls": {
				"title":"Late Calls",
				"tpl":"app/components/home/tpls/lateCalls.tpl",
				"showSearch": 0
			},
			"map": {
				"title":"Google Map",
				"tpl":"app/components/home/tpls/map.tpl",
				"showSearch": 0
			},
			"clearLists": {
				"title":"Clear Lists",
				"tpl":"app/components/home/tpls/clearLists.tpl",
				"showSearch": 0
			}
		}

		///////////////////////////////
		// LAYOUT 
		///////////////////////////////
		$scope.layouts = [
			{
				name: "Default",
				layout: {
					"columns": [
						{
							"id": "col1",
							"width": "700px",
							"boxes": [
								{
									"name": "jobsList",
									"height": "500px"
								},
								{
									"name": "jobDetail"
								}
							]
						},
						{
							"id": "col2",
							"width": "400px",
							"boxes": [
								{
									"name": "jobGroups",
									"height": "400px"
								},
								{
									"name": "potentialCouriers",
									"height": "200px"
								},
								
								{
									"name": "currentWork"
								}
							]
						},
						{
							"id": "col3",
							"width": "600px",
							"boxes": [
								{
									"name": "clearLists",
									"height": "600px"
								}
							]
						},
						{
							"id": "col4",
							"boxes": [
								{
									"name": "jobUpdates",
									"height": "300px"
								},
								{
									"name": "supports",
									"height": "300px"
								},
								{
									"name": "lateCalls"
								}
							]
						}
					]
				}
			}
		];


		$scope.groupJobsSelection = "";
		$scope.currentWorkSelection = "";
		$scope.potentialCouriersSelection = "";

		$scope.layout = angular.copy($scope.layouts[0].layout);


		$scope.loadLayout = function(i) {
			$scope.layout = angular.copy($scope.layouts[i].layout, function() {
				setTimeout( sizeHeadings(), 1000);

			});
			//$scope.$apply();
		}

		$scope.saveLayout = function() {


			angular.forEach($scope.layout.columns, function(column, colKey) {
					column.width = $("#co-"+column.id).css("flex-basis");
					angular.forEach(column.boxes, function(box, boxKey) {
						box.height = $("#box-"+box.name).css("flex-basis");
					});
			});


			$scope.gather.form = {
				id: "saveLayout", 
				title:"Save Layout",
				fields: [
					{
						"name": "layoutName",
						"label": "Layout Name",
						"value": ""
					}
				],
				onSubmit: function() {
					
					var layoutName = $("#saveLayout").find("input").val();

			 		var callData = {
						"call": "saveLayout",
						"layoutName": layoutName,
						"layout": $scope.layout
					}

					//DO THE API CALL
					DispatchData.doAPI(callData).then(function(data) {

						console.log(data);

						if(data.response == "Success") {				

							$scope.layouts = $scope.layouts.concat(
								{
									name: layoutName,
									layout: angular.copy($scope.layout)
								}
							);

						} else {

							alert("Critial Error");

						}

			        });





				},
				submitValue: "Save"
			}

			$scope.gather.showForm();

		}

		$scope.sortableOptions = {
			connectWith: ".column-sortable",
			items: '.box',
		    placeholder: "placeholder",
		    scroll: true,
		    scrollSensitivity: 100, 
		    scrollSpeed: 20,
		    handle:'.box-handle',
		    activate: function(e,ui) {
		       	var box = $("#"+ui.item.context.id);
		    	var parent = box.parent();
		    	parent.find(".box").each(function() {
		    		$(this).attr("data-height", $(this).height()+"px");
		    	});
		    },
		    update: function(e, ui) {
		    		setTimeout(function(){
		    			var box = $("#"+ui.item.context.id); 
		    			var parent = box.parent();
		    			parent.find(".box").each(function() {
		    				$(this).css({"flex-basis":$(this).attr("data-height")});
		    			});
		    			parent.find(".box").last().css({"flex-basis":"0"});
					},0);
		    }
	  	};
		
	  	$scope.openSearch = function(boxID) {

	  		if ($("#box-"+boxID).find(".box-search").hasClass("open")) {

		  		$("#box-"+boxID).find(".box-search input").fadeOut(function() {

		  			$("#box-"+boxID).find(".box-search").removeClass("open");
		  			$("#box-"+boxID).find(".box-search").animate({"width":"31px"}, 500);

		  		});

	  		} else {

		  		$("#box-"+boxID).find(".box-search").animate({"width":"200px"}, 500, function() {
		  			$("#box-"+boxID).find(".box-search").addClass("open");
		  			$("#box-"+boxID).find(".box-search input").fadeIn();
		  		});

	  		}

	  	}


	  	//Column Sorting
		$scope.sort = [];
		$scope.orderList = function(list, prop) {
				
			if ($scope.sort[list] != prop) {
				$scope.sort[list] = prop;
				$scope[list] = $filter('orderBy')($scope[list], prop);
			} else {
				$scope.sort[list] = "d-"+prop;
				$scope[list] = $filter('orderBy')($scope[list], "-"+prop);
			}
				
		}

		///////////////////////////
		// HOTKEYS 
		//////////////////////////

		hotkeys.add({
		  combo: 'ctrl+d',
		  description: 'Dispatch selected jobs',
		  allowIn: ['INPUT', 'SELECT', 'TEXTAREA'],
		  callback: function() {
		  	if ($(".activeTable .active").length > 0) {
		  	 $scope.dispatchJobsForm();
		  	}
		  }
		});

		hotkeys.add({
		  combo: 'esc',
		  description: 'Close gather screen',
		  allowIn: ['INPUT', 'SELECT', 'TEXTAREA'],
		  callback: function() {
			$(".gatherForm").hide();
			$(".eventForm").hide();
		  }
		});

		hotkeys.add({
		  combo: 'enter',
		  description: 'Submit gather form',
		  allowIn: ['INPUT', 'SELECT', 'TEXTAREA'],
		  callback: function() {
		  	if ($(".gatherForm").is(":visible") == true) {
				setTimeout($scope.gather.submit(), 0);
			}
		  }
		});

		$scope.selectForDispatch = function(job) {
			$scope.jobForDispatch = job;
		}


		////////////////////////////////////////
		// LOAD DISPATCH JOBS SCREEN
		///////////////////////////////////////
	  	 $scope.dispatchJobsForm = function() {
	  	 	$scope.gather.form = {
				id: "dispatchJobs", 
				title:"Dispatch Jobs",
				fields: [
					{
						"name": "courierNumber",
						"label": "Courier number...",
						"value": ""
					}
				],
				onSubmit: function() {
					$scope.dispatchJobs($("#gather-courierNumber").val());
				},
				submitValue: "Dispatch"
			}
			$scope.gather.showForm();
			
	  	 }

	  	 /////////////////////////////////////
	  	/// LATE CALLS
	  	$scope.lateCall = function(courier) {
	  		$scope.dispatchJobs(courier);
	  	}

		////////////////////////////////////////
		// DISPATCH THE JOBS
		///////////////////////////////////////
	  	 $scope.dispatchJobs = function(courier) {

	 		var callData = {
				"call": "dispatchJobs",
				"courier": courier,
				"jobs": []
			}

			$(".activeTable .active").each(function() {
				callData.jobs.push($(this).attr("data-jobid")); 
			});

			//DO THE API CALL
			DispatchData.doAPI(callData).then(function(data) {

				console.log(data);



				if(data.response == "Success") {

			        var list = $(".activeTable").attr("id");

			        setTimeout(function() { 	

			        	$(".activeTable .active").each(function() {
							
							//$(this).hide();
			                $(this).find(".selectjob").click();

			                var index = $scope[list].indexOf($scope.jobForDispatch);
			                console.log(index);
				        	$scope[list].splice(index, 1);
				        	$scope.$apply();

			        	});



			        },0);

			        if ($(".activeTable").attr("data-group") == "jobsGrouped") {


			        } else {
						$scope.currentJob = false;
						$scope.currentCourier = false;
						$scope.potentialCouriers = false;
						$scope.jobGroups = false;
						$scope.jobsCurrentList = false;
			        }

				} else {

					alert("Critial Error");

				}

	        });
	        //setTimeout(, 0);
	        //console.log($scope.jobsForDispatch);

	  	 }


	  	//////////////////////////////
	  	//  PALLET CONTROLS //
	  	/////////////////////////////
		$scope.palletMenu = [
		    // NEW IMPLEMENTATION
		    {
		        text: 'Delete',
		        click: function ($itemScope, $event, modelValue, text, $li) {
		            //$scope.items.splice($itemScope.$index, 1);

				  var index = $scope.currentJob.PalletInfo.indexOf($itemScope.pallet);
				  $scope.currentJob.PalletInfo.splice(index, 1);     

	            //LOCK WITH CURRENT USER

		        }
		    }
		];



	  	$scope.newPallet = function() {

	  		$scope.gather.form = {
				id: "newPallet", 
				tpl:"multi",
				title:"Add Pallet",
				fields: [
					{
						"name": "amount",
						"label": "# of pallets...",
						"colSize":"6"
					},
					{
						"name": "weight",
						"label": "Weight (KG)",
						"colSize":"6"
					},
					{
						"name": "length",
						"label": "Length (m)",
						"colSize":"6"
					},
					{
						"name": "depth",
						"label": "Depth (m)",
						"colSize":"6"
					},
					{
						"name": "height",
						"label": "Height (m)",
						"colSize":"6"
					},
					{
						"name": "pu",
						"label": "PU...",
						"colSize":"6"
					},
					{
						"name": "do",
						"label": "DO...",
						"colSize":"6"
					},

					{
						"name": "dgclass",
						"label": "DG Class...",
						"colSize":"6"
					},
					{
						"name": "notes",
						"label": "Notes...",
						"colSize":"12",
						"type": "textarea"
					}
				],
				onSubmit: function() {

					var newP = {};

					$scope.gather.form.fields.forEach(function(field) {
						if (field.name == 'amount') { newP["Quantity"] = field.value; }
						if (field.name == 'weight') { newP["Weight"] = field.value; }
						if (field.name == 'length') { newP["Length"] = field.value; }
						if (field.name == 'depth') { newP["Depth"] = field.value; }
						if (field.name == 'height') { newP["Height"] = field.value; }
						if (field.name == 'pu') { newP["PU"] = field.value; }
						if (field.name == 'do') { newP["DO"] = field.value; }
						if (field.name == 'dgclass') { newP["DGClass"] = field.value; }
						if (field.name == 'notes') { newP["Notes"] = field.value; }
					
					});

			 		var callData = {
						"call": "addPallet",
						"palletData": newP,
						"jobID": $scope.currentJob.ID
					}

					DispatchData.doAPI(callData).then(function(data) {
						
						console.log(data);
		        	//YAY ITS VISABLE

						if(data.response == "Success") {

							newP['ID'] = data.submitID;
							if (!$scope.currentJob.PalletInfo) {
								$scope.currentJob.PalletInfo = [];
							}
					        $scope.currentJob.PalletInfo.push(newP);

						} else {

							console.log("Critial Error");

						}

			        });
					
				},
				submitValue: "Add Pallet"
			}
			$scope.gather.showForm();

	  	}

	  	$scope.currentPallet = "";

	  	$scope.editPallet = function(pallet) {

	  		$scope.currentPallet = pallet;

	  		$scope.gather.form = {
				id: "editPallet", 
				title:"Edit Pallet",
				tpl:"multi",
				fields: [
					{
						"name": "amount",
						"label": "# of pallets",
						"colSize":"6",
						"value": pallet.Quantity
					},
					{
						"name": "weight",
						"label": "Weight (KG)",
						"colSize":"6",
						"value": pallet.Weight
					},
					{
						"name": "length",
						"label": "Length (m)",
						"colSize":"6",
						"value": pallet.Length
					},
					{
						"name": "depth",
						"label": "Depth (m)",
						"colSize":"6",
						"value": pallet.Depth
					},
					{
						"name": "height",
						"label": "Height (m)",
						"colSize":"6",
						"value": pallet.Height
					},
					{
						"name": "pu",
						"label": "PU",
						"colSize":"6",
						"value": pallet.PU
					},
					{
						"name": "do",
						"label": "DO",
						"colSize":"6",
						"value": pallet.DO
					},

					{
						"name": "dgclass",
						"label": "DG Class",
						"colSize":"6",
						"value": pallet.DGClass
					},
					{
						"name": "notes",
						"label": "Notes",
						"colSize":"12",
						"type": "textarea",
						"value": pallet.Notes
					}
				],
				onSubmit: function() {

					var newP = {};

					$scope.gather.form.fields.forEach(function(field) {
						if (field.name == 'amount') { newP["Quantity"] = field.value; }
						if (field.name == 'weight') { newP["Weight"] = field.value; }
						if (field.name == 'length') { newP["Length"] = field.value; }
						if (field.name == 'depth') { newP["Depth"] = field.value; }
						if (field.name == 'height') { newP["Height"] = field.value; }
						if (field.name == 'pu') { newP["PU"] = field.value; }
						if (field.name == 'do') { newP["DO"] = field.value; }
						if (field.name == 'dgclass') { newP["DGClass"] = field.value; }
						if (field.name == 'notes') { newP["Notes"] = field.value; }
					});

					newP["ID"] = $scope.currentPallet.ID;

			 		var callData = {
						"call": "editPallet",
						"palletData": newP,
						"palletID": $scope.currentPallet.ID,
						"jobID": $scope.currentJob.ID
					}

					DispatchData.doAPI(callData).then(function(data) {
						
						console.log(data);
		        	//YAY ITS VISABLE

						if(data.response == "Success") {

							//$scope.currentPallet.Quantity = newP.Quantity

							for (var key in $scope.currentPallet) {
							    $scope.currentPallet[key] = newP[key];

							}

					        //$scope.currentPallet = angular.copy(newP);

						} else {

							console.log("Critial Error");

						}

			        });
					
				},
				submitValue: "Edit Pallet"
			}
			$scope.gather.showForm();

	  	}


	  	//ACTIVATEDROP

	  	$scope.activateDrop = function() {
	  		setTimeout(function(){

				$(document).ready(function(event){
				    $(".droppable-row").droppable({
				      classes: {
				        "ui-droppable-hover": "active"
				      },
				      drop: function( event, ui ) {
				        //$(this).addClass("active");


				        //STOP DROPPABLE FIRING OUTSIDE ITS CONTAINER & HIDDEN
						var parent = $(this).parents(".box");
						var parentOffset = parent.offset();
						var parentTop = parentOffset.top;
						var parentBottom = parentTop + parent.outerHeight();

						var row = $(this);
						var rowOffset = row.offset();
						var rowTop = rowOffset.top;
						var rowBottom = rowTop + row.outerHeight();

				        if(rowTop < parentBottom && rowBottom > parentTop) {

				        	//YAY ITS VISABLE
					        $(this).css({"background-color":"#c6dfad"});
					        $(this).animate({backgroundColor:'inherit'}, 300, function() {
					        	$(this).removeAttr('style');
					        });
					        $scope.dispatchJobs($(this).attr("data-courier"));
					        $scope.getClearListsData();

				        }



				      }
				    });
				});
			}, 0);
	  	}

		////////////////////////////
		// POTENTIAL COURIERS
		////////////////////////////

	  	$scope.getPotentialCouriers = function() {

	  		$("#box-potentialCouriers .loading").show();
			DispatchData.getPotentialCouriers($scope.selectedJobs).then(function(data) {
				$scope.potentialCouriers = data;

				//Set headings
				setTimeout(function(){ sizeHeadings($("#potentialCouriers").parents(".column")); }, 1000);
				setTimeout(function(){ sizeHeadings($("#potentialCouriers").parents(".column")); }, 2000);

				$("#box-potentialCouriers .loading").fadeOut();

				$scope.activateDrop();

			});

		}

		// Select the courier

		$scope.selectCourier = function(courier) {


			$("#box-jobDetail").find(".loading").show();

			$scope.getGroupedJobs(courier);
			$scope.groupJobsSelection = (" for Courier "+courier.courier);
			$scope.getCurrentJobs(courier);
			$scope.currentWorkSelection = (" for Courier "+courier.courier);

			//SHOW MAP
			$scope.currentJob = null;
			$scope.currentCourier = courier;

			$scope.currentSelection = (" for Courier "+courier.courier);

			setTimeout(function(){
				$(document).ready(function(event){
					$("#box-jobDetail").find(".loading").fadeOut();
				});
			 }, 100);


		}

		////////////////////////////
		// GROUPED JOBS
		////////////////////////////

	  	$scope.getGroupedJobs = function(jobs,courier) {

	  		$("#box-jobGroups").find(".loading").show();

			DispatchData.getJobsGrouped().then(function(data) {

				$("#box-jobGroups").find(".loading").fadeOut();

				$scope.jobGroups = data;

				setTimeout(function(){ sizeHeadings($("#jobGroups").parents(".column")); }, 1000);
				setTimeout(function(){ sizeHeadings($("#jobGroups").parents(".column")); }, 2000);

			});

		}

		////////////////////////////
		// CURRENT JOBS
		////////////////////////////

	  	$scope.getCurrentJobs = function(courier) {

			$("#box-currentWork").find(".loading").show();
			DispatchData.getJobsCurrent().then(function(data) {
				$("#box-currentWork").find(".loading").fadeOut();
				$scope.jobsCurrentList = data;
				setTimeout(function(){ sizeHeadings($("#currentWork").parents(".column")); }, 1000);
				setTimeout(function(){ sizeHeadings($("#currentWork").parents(".column")); }, 2000);
			});

		}

		$scope.jobFilters = {"status":"all","area":"all"};
		$scope.setFilters = function(data) {

			if (data.status) {
				$scope.jobFilters.status = data.status;
			}



			if (data.area) {
				$scope.jobFilters.area = data.area;
			}	

			$scope.getData();

		}

		$scope.getData = function() {

		  	///////////////////////////////
			// JOB LIST
			///////////////////////////////
		
			//Get Job Data

			$("#box-jobsList").find(".loading").show();
			$scope.jobList = [];
			$scope.currentJob = false;
			$scope.potentialCouriers = false;
			$scope.jobGroups = false;
			$scope.jobsCurrentList = false;
			$scope.currentCourier = false;

			DispatchData.getJobsFilter($scope.jobFilters).then(function(data) {
				$scope.jobList = data;
				$("#box-jobsList .loading").fadeOut();
				setTimeout(function(){ sizeHeadings($("#jobList").parents(".column")); }, 100);
			
			});

			$scope.getClearListsData = function() {
				DispatchData.getClearLists().then(function(data) {
					$scope.clearLists = data;
					setTimeout(function() { $("#clearLists .loading").fadeOut();	}, 0);
					console.log($scope.clearLists);	
					$scope.activateDrop();
				});
			}

			$scope.getClearListsData();



			//Select Job
			$scope.selectJob = function(job, clear) {

				setTimeout(function(){

					$scope.selectedJobs = [];

		        	$(".activeTable .active").each(function() {
						
						//$(this).hide();
		                $(this).find(".selectjob").click();

		                $scope.selectedJobs.push($scope.jobForDispatch.ID);

		            });

					$scope.currentJob = job;
					$scope.$apply();

					console.log(job);
					if(clear == true) {
						$scope.jobGroups = false;
						$scope.jobsCurrentList = false;
						$scope.getPotentialCouriers();
						$scope.potentialCouriersSelection = (" for Job "+job.JobNo);
						$scope.getGroupedJobs();
						$scope.groupJobsSelection = (" for Job "+job.JobNo);
						$scope.currentWorkSelection = "";

						

					} 
					$scope.currentCourier = null;
					$scope.currentSelection = " for Job "+job.JobNo;

		        }, 0);

	            
			}

			$scope.jobsMenu = [
			    // NEW IMPLEMENTATION
			    {
			        text: 'Dispatch Selected',
			        click: function ($itemScope, $event, modelValue, text, $li) {
			        	$scope.dispatchJobsForm();
			        }
			    },
			    {
			        text: 'Restore',
			        click: function ($itemScope, $event, modelValue, text, $li) {
			            //$scope.selected = $itemScope.item.name;
			        }
			    },
			    {
			        text: 'Re-dispatch',
			        click: function ($itemScope, $event, modelValue, text, $li) {
			            //$scope.items.splice($itemScope.$index, 1);
			        }
			    },
			    {
			        text: 'Split Job',
			        click: function ($itemScope, $event, modelValue, text, $li) {
			            //$scope.items.splice($itemScope.$index, 1);
			        }
			    }
			];






			$scope.courierMenu = [
			    // NEW IMPLEMENTATION
			    {
			        text: 'Dispatch Selected',
			        click: function ($itemScope, $event, modelValue, text, $li) {
			            //$scope.selected = $itemScope.item.name;
			            $scope.dispatchJobs($itemScope.courier.courier);
			        }
			    }
			];

			////////////////////////////
			// COURIER MOVEMENTS THROUGH
			////////////////////////////
			$("#box-couriersMoveThrough").find(".loading").show();

			
			DispatchData.getCouriersThrough().then(function(data) {
				$scope.couriersThrough = data;

				

				$scope.couriersThroughMenu = [
				    // NEW IMPLEMENTATION
				    {
				        text: 'Delete',
				        click: function ($itemScope, $event, modelValue, text, $li) {
				            //$scope.selected = $itemScope.item.name;
				            $(".rightActiveTable .active").fadeOut();
				        }
				    }
				];
				$scope.activateDrop();
				setTimeout(function(){ $("#box-couriersMoveThrough").find(".loading").fadeOut(); }, 100);


				setTimeout(function(){ sizeHeadings($("#couriersThrough").parents(".column")); }, 1000);
				setTimeout(function(){ sizeHeadings($("#couriersThrough").parents(".column")); }, 2000);

			});


			////////////////////////////
			// COURIER MOVEMENTS PICKED UP
			////////////////////////////

			$("#box-courierMovePickedUp").find(".loading").show();

			DispatchData.getCouriersPicked().then(function(data) {
				$scope.couriersPicked = data;

				$scope.couriersPickedMenu = [
				    // NEW IMPLEMENTATION
				    {
				        text: 'Hold',
				        click: function ($itemScope, $event, modelValue, text, $li) {
				            //$scope.selected = $itemScope.item.name;


					 		var callData = {
								"call": "holdCourier",
								"courier": $itemScope.courier
							}

							DispatchData.doAPI(callData).then(function(data) {
								
								console.log(data);
				        	//YAY ITS VISABLE

								if(data.response == "Success") {

							        $(".rightActiveTable .active").css({"background-color":"#c6dfad"});

							        $(".rightActiveTable .active").animate({backgroundColor:'inherit'}, 300, function() {
							        	$(this).removeAttr('style');
							        });

								} else {

									console.log("Critial Error");

								}

					        });

				        }
				    },
				    {
				        text: 'Head',
				        click: function ($itemScope, $event, modelValue, text, $li) {
				            //$scope.items.splice($itemScope.$index, 1);


							var callData = {
								"call": "headCourier",
								"courier": $itemScope.courier
							}

							DispatchData.doAPI(callData).then(function(data) {
								
								console.log(data);
				        	//YAY ITS VISABLE

								if(data.response == "Success") {

							        $(".rightActiveTable .active").css({"background-color":"#c6dfad"});

							        $(".rightActiveTable .active").animate({backgroundColor:'inherit'}, 300, function() {
							        	$(this).removeAttr('style');
							        });

								} else {

									console.log("Critial Error");

								}

					        });

				        }
				    },
				    {
				        text: 'Delete',
				        click: function ($itemScope, $event, modelValue, text, $li) {
				            //$scope.items.splice($itemScope.$index, 1);
				            $(".rightActiveTable .active").fadeOut();
				        }
				    }
				];

				setTimeout(function(){
					$(document).ready(function(event){
						$("#box-courierMovePickedUp").find(".loading").fadeOut();
					});
				 }, 100);

				setTimeout(function(){ sizeHeadings($("#couriersPicked").parents(".column")); }, 1000);
				setTimeout(function(){ sizeHeadings($("#couriersPicked").parents(".column")); }, 2000);

			});


			////////////////////////////
			// COURIER MOVEMENTS CLEAR
			////////////////////////////
			$("#box-courierMoveClear").find(".loading").show();
			DispatchData.getCouriersClear().then(function(data) {
				$scope.couriersClear = data;

				$scope.couriersClearMenu = [
				    // NEW IMPLEMENTATION
				    {
				        text: 'Hold',
				        click: function ($itemScope, $event, modelValue, text, $li) {
				            //$scope.selected = $itemScope.item.name;


					 		var callData = {
								"call": "holdCourier",
								"courier": $itemScope.courier
							}

							DispatchData.doAPI(callData).then(function(data) {
								
								console.log(data);
				        	//YAY ITS VISABLE

								if(data.response == "Success") {

							        $(".rightActiveTable .active").css({"background-color":"#c6dfad"});

							        $(".rightActiveTable .active").animate({backgroundColor:'inherit'}, 300, function() {
							        	$(this).removeAttr('style');
							        });

								} else {

									console.log("Critial Error");

								}

					        });

				        }
				    },
				    {
				        text: 'Move',
				        click: function ($itemScope, $event, modelValue, text, $li) {
				            //$scope.items.splice($itemScope.$index, 1);


							var callData = {
								"call": "moveCourier",
								"courier": $itemScope.courier
							}

							DispatchData.doAPI(callData).then(function(data) {
								
								console.log(data);
				        	//YAY ITS VISABLE

								if(data.response == "Success") {

							        $(".rightActiveTable .active").css({"background-color":"#c6dfad"});

							        $(".rightActiveTable .active").animate({backgroundColor:'inherit'}, 300, function() {
							        	$(this).removeAttr('style');
							        });

								} else {

									console.log("Critial Error");

								}

					        });

				        }
				    },
				    {
				        text: 'Delete',
				        click: function ($itemScope, $event, modelValue, text, $li) {
				            //$scope.items.splice($itemScope.$index, 1);
				            $(".rightActiveTable .active").fadeOut();
				        }
				    }
				];

				setTimeout(function(){
					$(document).ready(function(event){
						$("#box-courierMoveClear").find(".loading").fadeOut();
					});
				 }, 100);

				setTimeout(function(){ sizeHeadings($("#couriersClear").parents(".column")); }, 1000);
				setTimeout(function(){ sizeHeadings($("#couriersClear").parents(".column")); }, 2000);

			});


			////////////////////////////
			// AREA LIST
			////////////////////////////

			$("#box-areaList").find(".loading").show();
			DispatchData.getAreaList().then(function(data) {
				$scope.areaList = data;

				setTimeout(function(){
					$(document).ready(function(event){
						$("#box-areaList").find(".loading").fadeOut();
					});
				 }, 100);

				setTimeout(function(){ sizeHeadings($("#areaList").parents(".column")); }, 1000);
				setTimeout(function(){ sizeHeadings($("#areaList").parents(".column")); }, 2000);

			});

			////////////////////////////
			// JobUpdates
			////////////////////////////

			$("#box-jobUpdates").find(".loading").show();
			DispatchData.getJobUpdates().then(function(data) {
				$scope.jobUpdates = data;

				$scope.jobUpdatesMenu = [
				    // NEW IMPLEMENTATION
				    {
				        text: 'Dismiss',
				        click: function ($itemScope, $event, modelValue, text, $li) {
				            //$scope.selected = $itemScope.item.name;


					 		var callData = {
								"call": "dismissSupport",
								"support": $itemScope.support
							}

							DispatchData.doAPI(callData).then(function(data) {
								
								console.log(data);
				        	//YAY ITS VISABLE

								if(data.response == "Success") {

							        $(".rightActiveTable .active").fadeOut();

								} else {

									console.log("Critial Error");

								}

					        });

				        }
				    },
				    {
				        text: 'Support',
				        click: function ($itemScope, $event, modelValue, text, $li) {
				            //$scope.items.splice($itemScope.$index, 1);


				            //BRING UP CURRENT EVENT FORM TO ENTER A SUPPORT

				        }
				    }
				];


				setTimeout(function(){
					$(document).ready(function(event){
						$("#box-jobUpdates").find(".loading").fadeOut();
					});
				 }, 100);





				setTimeout(function(){ sizeHeadings($("#jobUpdates").parents(".column")); }, 1000);
				setTimeout(function(){ sizeHeadings($("#jobUpdates").parents(".column")); }, 2000);





			});

			////////////////////////////
			// SUPPORTS
			////////////////////////////

			$("#box-supports").find(".loading").show();
			DispatchData.getSupports().then(function(data) {
				$scope.supports = data;


				$scope.supportMenu = [
				    // NEW IMPLEMENTATION
				    {
				        text: 'Complete',
				        click: function ($itemScope, $event, modelValue, text, $li) {
				            //$scope.selected = $itemScope.item.name;


					 		var callData = {
								"call": "dismissSupport",
								"support": $itemScope.support
							}

							DispatchData.doAPI(callData).then(function(data) {
								
								console.log(data);
				        	//YAY ITS VISABLE

								if(data.response == "Success") {

							        $(".rightActiveTable .active").fadeOut();

								} else {

									console.log("Critial Error");

								}

					        });

				        }
				    },
				    {
				        text: 'Lock',
				        click: function ($itemScope, $event, modelValue, text, $li) {
				            //$scope.items.splice($itemScope.$index, 1);


				            //LOCK WITH CURRENT USER

				        }
				    }
				];


				setTimeout(function(){
					$(document).ready(function(event){
						$("#box-supports").find(".loading").fadeOut();
					});
				 }, 100);


				setTimeout(function(){ sizeHeadings($("#getSupports").parents(".column")); }, 1000);
				setTimeout(function(){ sizeHeadings($("#getSupports").parents(".column")); }, 2000);
			});






			////////////////////////////
			// LATE CALLS
			////////////////////////////

			$("#box-lateCalls").find(".loading").show();
			DispatchData.getLateCalls().then(function(data) {
				$scope.lateCalls = data;


				$scope.lateCallsMenu = [
				    // NEW IMPLEMENTATION
				    {
				        text: 'Complete',
				        click: function ($itemScope, $event, modelValue, text, $li) {
				            //$scope.selected = $itemScope.item.name;


					 		var callData = {
								"call": "dismissSupport",
								"support": $itemScope.support
							}

							DispatchData.doAPI(callData).then(function(data) {
								
								console.log(data);
				        	//YAY ITS VISABLE

								if(data.response == "Success") {

							        $(".rightActiveTable .active").fadeOut();

								} else {

									console.log("Critial Error");

								}

					        });

				        }
				    },
				    {
				        text: 'Lock',
				        click: function ($itemScope, $event, modelValue, text, $li) {
				            //$scope.items.splice($itemScope.$index, 1);


				            //LOCK WITH CURRENT USER

				        }
				    }
				];

				setTimeout(function(){
					$(document).ready(function(event){
						$("#box-lateCalls").find(".loading").fadeOut();
					});
				 }, 100);

				setTimeout(function(){ sizeHeadings($("#getLastCalls").parents(".column")); }, 1000);
				setTimeout(function(){ sizeHeadings($("#getLastCalls").parents(".column")); }, 2000);
			});

			///////////////////////////
			// JOB DETAIL
			//////////////////////////
			$scope.formatDate = function(dateString) {
				//console.log(dateString);
				//return new Date("1988/08/21" + dateString);
			}
		}

		$scope.getData();

		/////////////////////////
		// JOB DETAILS
		/////////////////////////


		$scope.detailAddressMenu = [
		    // NEW IMPLEMENTATION
		    {
		        text: 'Update GPS',
		        click: function ($itemScope, $event, modelValue, text, $li) {
		            //$scope.selected = $itemScope.item.name;

		            console.log($event.currentTarget.attributes['data-field'].nodeValue);

		           $scope.updateGPS($event.currentTarget.attributes['data-field'].nodeValue);

		        }
		    }
		];


		$scope.updateGPS = function(field) {
			
			if (field == "ToAddress") {


				if ($scope.currentJob.DeliveryLongitude) {

					var lat = $scope.currentJob.DeliveryLatitude;
					var long = $scope.currentJob.DeliveryLongitude;
					var q = $("#gpsMap").attr("data-src") + lat + "," + long;
				} else {
					var lat = "";
					var long = "";
					var q = $("#gpsMap").attr("data-src") + encodeURIComponent($scope.currentJob[field]);
				}
			} else {
				console.log("hi");
				if ($scope.currentJob.PickUpLongitude) {
					var lat = $scope.currentJob.PickUpLatitude;
					var long = $scope.currentJob.PickUpLongitude;
					var q = $("#gpsMap").attr("data-src") + lat + "," + long;
				} else {
					var lat = "";
					var long = "";
					var q = $("#gpsMap").attr("data-src") + encodeURIComponent($scope.currentJob[field]);					
				}
			}

			console.log($scope.currentJob.PickupLatitude);
			console.log(q);
			$("#gpsMap").attr("src", q);

			$scope.gpsForm = {
				"data": {
					"address": $scope.currentJob[field],
					"lat": lat,
					"long": long
				},
				submit: function (location) {

			 		var callData = {
						"call": "updateGeo",
						"address": field,
						"lat": location.lat(),
						"long": location.lng(),
						"jobID": $scope.currentJob.ID
					}

					DispatchData.doAPI(callData).then(function(data) {
						console.log(data);
						if(data.response == "Success") {
					       
							if (field == "ToAddress") {
								$scope.currentJob.DeliveryLongitude = location.lng();
								$scope.currentJob.DeliveryLatitude = location.lat();
							} else {
								$scope.currentJob.PickUpLongitude = location.lng();
								$scope.currentJob.PickUpLatitude = location.lat();
							}

						} else {

							alert("Critial Error");

						}

						$(".gpsForm").hide(0);

			        });


				},
				cancel: function () {
					$(".gpsForm").hide(0);
				}
			}



			$(".gpsForm").show(0);

			$scope.$watch('gpsForm.details', function (newValue, oldValue, scope) {
				setTimeout(function() { 
				if ($scope.gpsForm.search) {

			    	$("#gpsMap").attr("src", $("#gpsMap").attr("data-src") + encodeURIComponent($scope.gpsForm.search));
			    	if ($scope.gpsForm.details.geometry.location) {
				    	$scope.gpsForm.data.lat = $scope.gpsForm.details.geometry.location.lat();
				    	$scope.gpsForm.data.long = $scope.gpsForm.details.geometry.location.lng();
			    	}

				} else {
					if (!$scope.gpsForm.data.long) {
						$("#gpsMap").attr("src", $("#gpsMap").attr("data-src") + "Auckland");
					}
				}
				},1000);
			});

			$scope.copyGpsAddress = function() {
				$scope.gpsForm.search = angular.copy($scope.gpsForm.data.address);
				$("#gpsSearch").focus();
			}


		};

		//$scope.updateGpsMap = function() {
		//	console.log($scope.gpsForm.data.address);

		//	setTimeout(function() {
		//		$("#gpsMap").attr("src", $("#gpsMap").attr("data-src") + $scope.gpsForm.data.address);
		//	}, 0);
		/// }



		$scope.editDetailField = function(fieldName, label, value, jobID, type, options) {
			console.log("hey");

			if (type == "time" || type == "date") {

				if (!(value instanceof Date)) {
					value = new Date(value);
				} 


			}
			
			if (type == "select") {



			}

	  	 	$scope.gather.form = {
				id: "editField", 
				title:"Edit "+label,
				fields: [
					{
						"name": fieldName,
						"label": label+"...",
						"value": value,
						"jobID": jobID,
						"type": type,
						"options": options
					}
				],
				onSubmit: function() {

					$scope.updateDetailField($scope.gather.form.fields[0].name, $scope.gather.form.fields[0].value, $scope.gather.form.fields[0].jobID);

				},
				submitValue: "Update Field"
			}
			$scope.gather.showForm();

		}

		$scope.updateDetailField = function(field, value, jobID) {

	 		var callData = {
				"call": "updateDetailField",
				"field":field,
				"value": value,
				"jobID": jobID
			}

			DispatchData.doAPI(callData).then(function(data) {

				if(data.response == "Success") {
			       
					$scope.currentJob[field] = value;

				} else {

					alert("Critial Error");

				}

	        });

		}

		$scope.addEvent = function() {

			var time = new Date();
			time.setSeconds(0);
			time.setMilliseconds(0);

			$scope.eventForm = {
				"data": {
					"jobNum": $scope.currentJob.JobNo,
					"client": $scope.currentJob.Client,
					"date": new Date(),
					"time": time
				},
				submit: function () {

				},
				cancel: function () {
					$(".eventForm").hide(0);
				}
			}

			$(".eventForm").show(0);
			/*
			$(document).ready( function() {

				var date = 
				var time = ;
				console.log(date + " | " + time);

			    $('.todayDate').val(date);

			    $('.todayTime').val(time);

				console.log("that");
			});
			*/


		}

	}]);


