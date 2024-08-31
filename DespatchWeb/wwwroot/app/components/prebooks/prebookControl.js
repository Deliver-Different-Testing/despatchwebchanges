function PrebookController($scope, jdSvc, uPBData, $state, $stateParams, $filter, $parse, hotkeys, $location, NgMap, GeoCoder, $mdDialog, $timeout) {
    const ctrl = this;
    $scope.isAdmin = (ClientInternal === "True");
    $scope.mapSetting = {
        "allCouriers": false,
        "allRuns": false
    };

    ctrl.jdSvc = jdSvc;

    $scope.searchBox = "";
    $scope.selectedEvents = [];
    $scope.maxSize = 5;     // Limit number for pagination display number.
    $scope.totalCount = 0;  // Total number of items in all pages. initialize as a zero
    $scope.pageIndex = 1;   // Current page number. First page is 1.-->
    $scope.pageSizeSelected = 50; // Maximum number of items per page.

    $scope.updateGPS = (currentJob, field, fromRightClick) => {
        jdSvc.updateGPS(currentJob, field, fromRightClick);
    };

    $scope.promise = null; // This will hold our loading promise


    ctrl.openSearch = (boxName, index) => {
        if (!ctrl.showInput) {
            ctrl.showInput = {};
        }
        ctrl.showInput[boxName + '-' + index] = !ctrl.showInput[boxName + '-' + index];
        ctrl.jobRecordSearchText = '';
        ctrl.selectedJobRecord = null;
    };

    ctrl.jobRecordSearchText = "";

    /**
     * @param {string} searchText
     */
    this.jobRecordSearch = function (searchText) {
        console.log(searchText);
        if (!searchText) {
            return [];
        }

        searchText = searchText.toLowerCase();

        return $scope.jobList
            .filter(function (job) {
                return job.jobNo.toLowerCase().indexOf(searchText) !== -1;
            })
            .map(function (job) {
                return {
                    text: job.jobNo,
                    id: job.id
                };
            });
    };


    /**
     * @param {number} selectedJobId
     */
    ctrl.JobRecordSelected = selectedJobId => {
        $scope.selectJobDetail(selectedJobId);
    }

    $scope.gather = {
        submit: () => {
            angular.element(".gatherForm").hide();
            $scope.gather.form.onSubmit().then(response => {

                $scope.selectJobDetail($scope.currentJob.id);
            });
        },
        cancel: () => {
            angular.element(".gatherForm").hide();
        },
        showForm: () => {
            console.log("Prebook gather form showForm");
            angular.element(".gatherForm").show(0, () => {
                $timeout(() => {
                    angular.element(".gatherForm .focusMe").focus();
                }, 100);
            });
        },
        submitValue: "Save"
    };

    jdSvc.setGather($scope.gather);

    $scope.options = {
        "detail": {
            "size": [
                {
                    "id": 1,
                    "label": "Bike"
                },
                {
                    "id": 2,
                    "label": "Car"
                },
                {
                    "id": 3,
                    "label": "Van"
                },
                {
                    "id": 4,
                    "label": "Truck"
                },
                {
                    "id": 5,
                    "label": "Scooter"
                }
            ],
            "tracking": [
                {
                    "id": 1,
                    "label": "Email"
                },
                {
                    "id": 2,
                    "label": "Mobile"
                },
                {
                    "id": 3,
                    "label": "Email & Mobile"
                }
            ],
            "DGClass": [
                {
                    "id": 0,
                    "label": "0"
                },
                {
                    "id": 1,
                    "label": "1"
                },
                {
                    "id": 2,
                    "label": "2"
                },
                {
                    "id": 3,
                    "label": "3"
                },
                {
                    "id": 4,
                    "label": "4"
                },
                {
                    "id": 5,
                    "label": "5"
                },
                {
                    "id": 6,
                    "label": "6"
                },
                {
                    "id": 7,
                    "label": "7"
                },
                {
                    "id": 8,
                    "label": "8"
                },
                {
                    "id": 9,
                    "label": "9"
                }
            ]
        }
    };

    $scope.boxes = {
        "jobList": {
            "title": "Job Data",
            "tpl": "app/components/prebooks/tpls/pbList.tpl?v3.13",
            "showSearch": 1,
            "showRefresh": 1,
            "model": "jobList",
            "headings": [
                {
                    "label": "Booked",
                    "name": "booked"
                },
                {
                    "label": "Speed",
                    "name": "speed"
                },
                {
                    "label": "Job #",
                    "name": "jobNumber"
                },
                {
                    "label": "Client",
                    "name": "clientCode"
                },
                {
                    "label": "From",
                    "name": "froAddress"
                },
                {
                    "label": "To",
                    "name": "toAddress"
                },
                {
                    "label": "Code",
                    "name": "code"
                },
                {
                    "label": "Send",
                    "name": "send"
                },
                {
                    "label": "Void",
                    "name": "void"
                }


            ]
        },
        "jobDetail": {
            "title": "Detail",
            "tpl": "app/components/prebooks/tpls/preBookDetail.tpl?v3.13",
            "showSearch": 0,
            "showDetailButtons": 1
        },
        "map": {
            "title": "Google Map",
            "tpl": "app/components/prebooks/tpls/map.tpl?v3.13",
            "showSearch": 0
        }

    };

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
                        "width": "1650px",
                        "boxes": [
                            {

                                "name": "jobList"
                            }
                        ]
                    },

                    {
                        "id": "col2",
                        "boxes": [
                            {
                                "name": "jobDetail",
                                "height": "950px"
                            },
                            {
                                "name": "map"
                            }
                        ]
                    }
                ]
            }
        }
    ];


    $scope.layout = angular.copy($scope.layouts[0].layout);

    $scope.loadLayout = i => {
        $scope.layout = angular.copy($scope.layouts[i].layout, () => {
            $timeout(sizeHeadings(), 1000);

        });
    };

    $scope.sortableOptions = {
        connectWith: ".column-sortable",
        items: '.box',
        placeholder: "placeholder",
        scroll: true,
        scrollSensitivity: 100,
        scrollSpeed: 20,
        handle: '.box-handle',
        activate: (e, ui) => {
            const box = angular.element("#" + ui.item.context.id);
            const parent = box.parent();
            parent.find(".box").each(function () {
                angular.element(this).attr("data-height", angular.element(this).height() + "px");
            });
        },
        update: (e, ui) => {
            $timeout(() => {
                const box = angular.element("#" + ui.item.context.id);
                const parent = box.parent();
                parent.find(".box").each(function () {
                    angular.element(this).css({"flex-basis": angular.element(this).attr("data-height")});
                });
                parent.find(".box").last().css({"flex-basis": "0"});
            }, 0);
        }
    };

    $scope.goToRunViewer = () => {
        console.log("goToRunViewer.");
        $state.go('home');
    };

    //Column Sorting
    $scope.sort = [];
    $scope.orderList = (list, prop) => {
        if ($scope.sort[list] !== prop) {
            $scope.sort[list] = prop;
            $scope[list] = $filter('orderBy')($scope[list], prop);
        } else {
            $scope.sort[list] = "d-" + prop;
            $scope[list] = $filter('orderBy')($scope[list], "-" + prop);
        }
    };

    $scope.refreshData = () => {
        $scope.promise = uPBData.getPreBookJobs().then(
            data => {
                $scope.jobList = data;
                return $scope.jobList;
            });
    };

    $scope.onOrderChange = function (order) {
        $scope.query.order = order;
        return $scope.refreshData();
    };

    $scope.selectJobData = (lat, lng) => {

        const toCompare = [];

        angular.forEach($scope.runBuilder, (job, key) => {
            toCompare.push([key, job.toLat, job.toLng]);
        });

        const closestIndex = closestLocation(lat, lng, toCompare);

        return $scope.runBuilder[closestIndex[0]];
    };


    $scope.showItems = job => {
        if (job.clientCode !== "Other") {

            if ($scope.cancelledSelected) {
                return true;

            } else {

                if (job.Status === "Cancelled") {

                    return false;

                } else {

                    return true;
                }

            }

        } else {
            return false;
        }


    };


    /////////////////////////////////

    $scope.showJobs = group => {

        angular.element("#box-jobsList").find(".loading").show();
        $scope.jobList = group.jobs;
        $timeout(() => {
            sizeHeadings(angular.element("#jobList").parents(".column"));
        }, 1000);
        angular.element("#box-jobsList .loading").fadeOut();


    };

    $scope.sizeName = sizeId => {
        if (!sizeId) {
            return "";
        }
        const sn = $scope.options.detail.size.find(obj => {

            return obj.id === sizeId;

        });
        return sn === undefined ? "" : sn.label;
    };

    //Select Job
    $scope.selectJobDetail = id => {
        console.log("select Job  " + id);

        clearTimeout($scope.myTimer);

        angular.element("#box-jobDetail").find(".loading").show();

        uPBData.getJobDetail(id).then(data => {
            $scope.currentJob = data;
            jdSvc.setJob($scope.currentJob);
            angular.element("#box-jobDetail").find(".loading").hide();
            $scope.currentSelection = " for Job " + data.jobNo;
            console.log($scope.currentJob.days);
            const freq = $scope.currentJob.days.slice(8, 9).trimEnd() === "" ? "0" : $scope.currentJob.days.slice(8, 9);
            console.log(freq);
            jdSvc.combos.frequency = [jdSvc.pickFrequency[freq]];
            console.log(jdSvc.combos.frequency);
            const hol = $scope.currentJob.days.slice(9, 10).trimEnd() === "" ? "0" : $scope.currentJob.days.slice(9, 10);
            console.log(hol);
            jdSvc.combos.holidays = [jdSvc.pickHolidays[hol]];
            console.log(jdSvc.combos.holidays);
            const selectedDays = [];
            const days = $scope.currentJob.days.slice(0, 7);
            for (let i = 0; i < days.length; i++) {
                if (days[i] === '1') {
                    selectedDays.push(jdSvc.pickDays[i]);
                }
            }
            console.log(selectedDays);
            jdSvc.combos.days = selectedDays;
            const jobs = [];
            jobs.push($scope.currentJob);
            displayRoutePointsOnly(jobs, true);
            setMapBounds();
            map.setZoom(14);
        });


    };


    //This method is calling from pagination number
    $scope.pageChanged = i => {

        $scope.pageIndex = i;
        $scope.refreshData();

    };

    //This method is calling from dropDown
    $scope.changePageSize = i => {
        $scope.pageIndex = 1;
        $scope.pageSizeSelected = i;
        $scope.refreshData();
    };


    jdSvc.setSelectJobDetail($scope.selectJobDetail);

    ctrl.voidPrebookJob = jobId => {
        const confirm = $mdDialog.confirm()
            .title('Void Prebook')
            .textContent("This will void TODAY'S copy of this prebook but not cancel it for good. Please confirm that you wish to do this?")
            .ok('Yes')
            .cancel('No');

        $mdDialog.show(confirm).then(() => {
            $scope.promise = uPBData.voidPrebookJob(jobId, FirstName, ContactID).then(response => {
                $scope.currentJob = null;
                return $scope.refreshData();
            });
        }, () => {
            // User clicked 'No'
        });
    }

    ctrl.sendPrebookJob = jobId => {
        const confirm = $mdDialog.confirm()
            .title('Accelerate Prebook')
            .textContent("This will send this prebook to the live dispatch screen now. Please confirm that you wish to do this?")
            .ok('Yes')
            .cancel('No');

        $mdDialog.show(confirm).then(() => {
            $scope.promise = uPBData.sendPrebookJob(jobId).then(response => {
                $scope.currentJob = null;
                return $scope.refreshData();
            });
        }, () => {
            // User clicked 'No'
        });
    }

    NgMap.getMap().then(map => {
        $scope.map = map;
        $scope.marker = map.markers[0];
        $scope.onMapReady();
        console.log("here...");

    });

    $scope.refreshData();

    $scope.onMapReady = () => {
        //$scope.heremaps = heremaps;

        const options = {
            minimumInputLength: 1,
            ajax: {
                url: 'https://autocomplete.geocoder.cit.api.here.com/6.2/suggest.json',
                delay: 250,
                dataType: "json",
                data: params => ({
                    query: params.term,
                    app_id: "bBPfh2x8Cauun3ygLMAx",
                    app_code: "yjfwTdkin_R2rGXYTrwWVg",
                    beginHighlight: "<b>",
                    endHighlight: "</b>",
                    country: "NZL"
                }),
                processResults: data => ({
                    results: $.map(data.suggestions, obj => ({
                        id: obj.locationId,
                        text: obj.label.split(", ").reverse().join(", ")
                    }))
                })
            },
            escapeMarkup: markup => markup
        };

        angular.element("#location").select2(options).on("select2:select", e => {
            $.getJSON("https://geocoder.cit.api.here.com/6.2/geocode.json", {
                app_id: "bBPfh2x8Cauun3ygLMAx",
                app_code: "yjfwTdkin_R2rGXYTrwWVg",
                locationId: e.params.data.id
            }).done(data => {
                const locn = data.Response.View[0].Result[0].Location;
                console.log("Suburb = " + locn.Address.District);
                console.log("PostCode = " + locn.Address.PostalCode);
                angular.element("#suburb").val(locn.Address.District);
                const mappedSub = jdSvc.pickSuburbs.find(obj => obj.text === locn.Address.District || obj.alias === locn.Address.District);
                if (mappedSub !== undefined) {
                    console.log(mappedSub);
                    angular.element('#our_suburb').val(mappedSub.id).trigger('change');
                } else {
                    angular.element('#our_suburb').val(null).trigger('change');
                }


                jdSvc.gpsForm.data.lat = locn.DisplayPosition.Latitude;
                jdSvc.gpsForm.data.long = locn.DisplayPosition.Longitude;
                jdSvc.gpsForm.data.address = locn.Address.Label;
                const ll = new google.maps.LatLng(locn.DisplayPosition.Latitude, locn.DisplayPosition.Longitude);
                $scope.map.setCenter(ll);
                $scope.marker.setPosition(ll);

            });
        });

        const suburbOptions = {
            minimumInputLength: 1,
            data: jdSvc.pickSuburbs
        };

        angular.element("#our_suburb").select2(suburbOptions);

        waitingDialog.hide();
    };

    $scope.highlightEvent = () => {
        angular.element("#jobList .active").each(function () {
            angular.element(this).removeClass("active");
        });
        //loop actives

        $timeout(() => {
            $scope.selectedEvents = [];
            angular.element("#jobList .active").each(function () {
                const eventIndex = angular.element(this).data("index");
                const event = $scope.jobList[eventIndex];
                $scope.selectedEvents.push(event);
            });
            //$scope.$apply();
        }, 10);


        $timeout(() => {
            sizeHeadings(angular.element("#jobList").parents(".column"));
        }, 1000);

    };

    $scope.jobListMenu =
        [
            {
                text: "Close Event",
                click: ($itemScope, $event, modelValue, text, $li) => {

                    $scope.gather.form = {
                        id: "closeEvent",
                        title: "Close Event?",
                        fields: [
                            {
                                "name": "editName",
                                "label": "Edit your name",
                                "value": ""
                            }
                        ],
                        onSubmit: () => {
                            angular.element("#box-jobList").find(".loading").show();
                            angular.element("#box-map").find(".loading").show();
                            const userName = angular.element("#gather-editName").val();
                            uPBData.closeEvent($itemScope.event.bulkEventID, userName).then(() => {
                                $scope.refreshData(1, true);
                            });


                        },
                        submitValue: "Close Event"
                    };

                    $scope.gather.showForm();

                }
            }
        ];
}

PrebookController.$inject = ['$scope', 'JobDetailService', 'uPBData', "$state", "$stateParams", "$filter", '$parse', "hotkeys",
    "$location", 'NgMap', 'GeoCoder', '$mdDialog', '$timeout'];


angular.module('uDispatch').controller('PBControl', PrebookController);


// Convert Degress to Radians
function Deg2Rad(deg) {
    return deg * Math.PI / 180;
}

function PythagorasEquirectangular(lat1, lon1, lat2, lon2) {
    lat1 = Deg2Rad(lat1);
    lat2 = Deg2Rad(lat2);
    lon1 = Deg2Rad(lon1);
    lon2 = Deg2Rad(lon2);
    const R = 6371; // km
    const x = (lon2 - lon1) * Math.cos((lat1 + lat2) / 2);
    const y = (lat2 - lat1);
    return Math.sqrt(x * x + y * y) * R;
}

function closestLocation(latitude, longitude, locations) {
    let mindif = 99999;
    let closest;

    for (let index = 0; index < locations.length; ++index) {
        const dif = PythagorasEquirectangular(latitude, longitude, locations[index][1], locations[index][2]);
        if (dif < mindif) {
            closest = index;
            mindif = dif;
        }
    }

    // return the nearest location
    return (locations[closest]);
}
