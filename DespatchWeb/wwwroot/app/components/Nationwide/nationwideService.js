angular
    .module("uDispatch")
    .factory("NWData",
        [
            "$http", function ($http) {
                return {
                    addNote: function (jobId, note, despatcherName, preBook) {
                        var method = preBook ? "job/AddJobBookingNote" : "job/AddNote";
                        return $http.post(method + "?jobId=" + jobId + "&note=" + note + "&despatcher=" + despatcherName).then(function (response) {
                            return response;
                        });
                    },
                    addPallet: function (pallet, preBook, despatcherName) {
                        return $http({
                            url: "job/AddPallet?preBook=" + preBook + "&despatcher=" + despatcherName,
                            method: "POST",
                            data: pallet
                        }).then(function(response) {
                            return response.data;
                        });
                    },
                    editPallet: function (pallet, preBook, despatcherName) {
                        return $http({
                            url: "job/EditPallet?preBook=" + preBook + "&despatcher=" + despatcherName,
                            method: "POST",
                            data: pallet
                        }).then(function (response) {
                            return response.data;
                        });
                    },
                    deletePallet: function (pallet, preBook, despatcherName) {
                        return $http({
                            url: "job/DeletePallet?preBook=" + preBook + "&despatcher=" + despatcherName,
                            method: "POST",
                            data: pallet
                        }).then(function (response) {
                            return response.data;
                        });
                    },
                    addFollowupEvent: function (jobNo, clientId, contact, staffId, courierId, jobId, jobType, despatcherName) {
                        return $http.post("courier/AddFollowupEvent?jobNo=" + jobNo + "&clientId=" + clientId + "&contact=" + contact + "&staffId=" + staffId + "&courierId=" + courierId + "&jobId=" + jobId + "&jobType=" + jobType + "&despatcherName=" + despatcherName).then(function (response) {
                            return response.data;
                        });
                    },
                    addRestoreEvent: function (jobNo, clientId, contact, staffId, courierId, jobId, jobType, despatcherName) {
                        return $http.post("job/AddRestoreEvent?jobNo=" + jobNo + "&clientId=" + clientId + "&contact=" + contact + "&staffId=" + staffId + "&courierId=" + courierId + "&jobId=" + jobId + "&jobType=" + jobType + "&despatcherName=" + despatcherName).then(function (response) {
                            return response.data;
                        });
                    },
                    addPriceSuburbChangeEvent: function (jobNo, clientId, contact, staffId, courierId, jobId, jobType, despatcherName) {
                        return $http.post("job/addPriceSuburbChangeEvent?jobNo=" + jobNo + "&clientId=" + clientId + "&contact=" + contact + "&staffId=" + staffId + "&courierId=" + courierId + "&jobId=" + jobId + "&jobType=" + jobType + "&despatcherName=" + despatcherName).then(function (response) {
                            return response.data;
                        });
                    },
                    addOtherEvent: function (jobNo, clientId, contact, staffId, courierId, jobId, jobType, despatcherName, notes) {
                        return $http.post("job/addOtherEvent?jobNo=" + jobNo + "&clientId=" + clientId + "&contact=" + contact + "&staffId=" + staffId + "&courierId=" + courierId + "&jobId=" + jobId + "&jobType=" + jobType + "&despatcherName=" + despatcherName + "&notes=" + notes).then(function (response) {
                            return response.data;
                        });
                    },
                    addEvent: function (jobNo, clientId, contact, staffId, courierId, jobId, jobType, despatcherName, notes, eventType) {
                        return $http.post("job/addEvent?jobNo=" + jobNo + "&clientId=" + clientId + "&contact=" + contact + "&staffId=" + staffId + "&courierId=" + courierId + "&jobId=" + jobId + "&jobType=" + jobType + "&despatcherName=" + despatcherName + "&notes=" + notes + "&eventType=" + eventType).then(function (response) {
                            return response.data;
                        });
                    },
                    exsalerateActivity: function(eventName, notes, clientId, jobNumber, despatcherName) {
                        return $http.post("job/ExsalerateActivity?eventName=" + eventName + "&notes=" + notes + "&clientId=" + clientId + "&jobNumber=" + jobNumber + "&despatcherName=" + despatcherName ).then(function (response) {
                            return response.data;
                        });
                    },
                    allocateJobs: function (courierId, dispId, jobIds) {
                        return $http.post("job/Allocate?courierId=" + courierId + "&dispId=" + dispId + "&jobIds=" + jobIds).then(function (response) {
                            return response;
                        });
                    },
                    reAllocateJobs: function (courierId, dispId, jobIds) {
                        return $http.post("job/ReAllocate?courierId=" + courierId + "&dispId=" + dispId + "&jobIds=" + jobIds).then(function (response) {
                            return response;
                        });
                    },
                    transferJob: function (courierId, dispId, jobId) {
                        return $http.post("job/Transfer?jobId=" + jobId + "&courierId=" + courierId + "&dispId=" + dispId).then(function (response) {
                            return response;
                        });
                    },
                    truckCourierStatus: function(courierId) {
                        return $http.post("courier/TruckCourierStatus?courierId=" + courierId).then(function (response) {
                            return response;
                        });
                    },
                    voidJob: function (jobId) {
                        return $http.post("job/Void?jobId=" + jobId).then(function (response) {
                            return response;
                        });
                    },
                    processUncheckDirect: function (jobId, despatcherName, staffId, currentSpeed) {
                        return $http.post("job/ProcessUncheckDirect?jobId=" + jobId + "&despatcher=" + despatcherName + "&staffId=" + staffId + "&currentSpeed=" + currentSpeed).then(function (response) {
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
                    resendJobs: function (jobIds) {
                        return $http.post("job/ResendSelected?jobIds=" + jobIds).then(function (response) {
                            return response.data;
                        });
                    },
                    resendAllJobs: function (courierId) {
                        return $http.post("job/ResendAll?courierId=" + courierId).then(function (response) {
                            return response.data;
                        });
                    },
                    sendPOD: function (jobId, email) {
                        return $http.get('job/SendPOD?jobId=' + jobId + '&toEmail=' + email).then(function (response) {
                            return response.data;
                        });
                    },
                    sendSMS: function (courierId, staffId, despatcherName, message) {
                        return $http.post("job/SendSMS?courierId=" + courierId + "&dispId=" + staffId + "&despatcherName=" + despatcherName + "&message=" + message).then(function (response) {
                            return response.data;
                        });
                    },
                    getJobs: function () {
                        return $http.get("app/components/home/api/jobsList.php").then(function (response) {
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
                    getJobsGrouped: function () {
                        return $http.get("app/components/home/api/jobsGroupedList.json").then(function (response) {
                            return response.data;
                        });

                    },
                    getJobsCurrent: function (courierId, done) {
                        return $http.get("job/current?courierId=" + courierId + "&done=" + done).then(function (response) {
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
                    getSupports: function (channel) {
                        return $http.get("job/supports?channel=" + channel).then(function (response) {
                            return response.data;
                        });

                    },
                    closeSupport: function (supportId, staffId) {
                        return $http.post("job/CloseSupport?supportId=" + supportId + "&staffId=" + staffId).then(function (response) {
                            return response;
                        });
                    },
                    lockSupport: function(id, dispatcher) {
                        return $http.post("job/LockSupport?id=" + id +"&dispatcher=" + dispatcher).then(function (response) {
                            return response;
                        });
                    },
                    unLockSupport: function (id, dispatcher) {
                        return $http.post("job/UnLockSupport?id=" + id + "&dispatcher=" + dispatcher).then(function (response) {
                            return response;
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
                    getClearListEnvelope: function (id) {
                        return $http.get("courier/ClearListEnvelope?clearListId=" + id).then(function (response) {
                            return response.data;
                        });
                    },
                    getActiveCouriers: function () {
                        return $http.get("courier/active").then(function (response) {
                            return response.data;
                        });
                    },
                    getActiveClients: function () {
                        return $http.get("home/ActiveClients").then(function (response) {
                            return response.data;
                        });
                    },
                    getClientContacts: function(contactId) {
                        return $http.get("home/ClientContacts?contactId=" + contactId).then(function (response) {
                            return response.data;
                        });
                    },
                    getPotentialCouriers: function (jobId) {
                        return $http.get("courier/PotentialCouriers?jobId=" + jobId).then(function (response) {
                            return response.data;
                        });
                    },
                    getCourierPosition: function (code) {
                        return $http.get("courier/location?code=" + code).then(function (response) {
                            return response.data;
                        }); 

                    },
                    getAvailableCourierLocation: function (minLng, minLat, maxLng, maxLat) {
                        return $http.get("courier/AvailableCourierLocation?minLng=" + minLng + "&minLat=" + minLat + "&maxLng=" + maxLng + "&maxLat=" + maxLat).then(function (response) {
                            return response.data;
                        });
                    },
                    getSuburbList: function () {
                        return $http.get("job/SuburbList").then(function (response) {
                            return response.data;
                        });
                    },
                    getSpeedList: function () {
                        return $http.get("job/SpeedList").then(function (response) {
                            return response.data;
                        });
                    },
                    getLeaveList: function () {
                        return $http.get("job/LeaveList").then(function (response) {
                            return response.data;
                        });
                    },
                    getUndeliverableList: function () {
                        return $http.get("job/UndeliverableList").then(function (response) {
                            return response.data;
                        });
                    },
                    getTruckItemsSummary: function (jobId, truckWeightLimit) {
                        return $http.get("job/TruckItemsSummary?jobId=" + jobId + "&truckWeightLimit=" + truckWeightLimit).then(function (response) {
                            return response.data;
                        });
                    },
                    lateCall: function (lateType, lateTime, minutes, pickupTime, alertLatePickup, deliveryTime, alertLateDelivery, jobNo, clientId, contact,  staffId, jobTime,  jobId,  jobType,  bookedSpeed, notifiedSpeed, despatcherName, calc) {
                        return $http.post("job/LateCall?lateType=" + lateType + "&lateTime=" + lateTime + "&minutes=" + minutes + "&pickupTime=" + pickupTime + "&alertLatePickup=" + alertLatePickup +
                            "&deliveryTime=" + deliveryTime + "&alertLateDelivery=" + alertLateDelivery + "&jobNo=" + jobNo + "&clientId=" + clientId + "&contact=" + contact +
                            "&staffId=" + staffId + "&jobTime=" + jobTime + "&jobId=" + jobId + "&jobType=" + jobType + "&bookedSpeed=" + bookedSpeed +
                            "&notifiedSpeed=" + notifiedSpeed + "&despatcherName=" + despatcherName + '&calculationRequired=' + calc).then(function (response) {
                            return response.data;
                        });
                    },

                    rateTruckJob: function (cid, fromId, toId, weight, size, speed, qty, bookedDate, pickUp, dropOff, privateRes, oversizeItems, overWeightItems, dGClass, truckStartTime, truckHours) {
                        return $http.get("job/RateTruckJob?clientId=" + cid + "&fromId=" + fromId + "&toId=" + toId + "&weight=" + weight + "&size=" + size + "&speed=" + speed + "&qty=" + qty + "&bookedDate=" + bookedDate +
                            "&pickup=" + pickUp + "&dropOff=" + dropOff + "&privateRes=" + privateRes + "&oversizeItems=" + oversizeItems + "&overWeightItems=" + overWeightItems + "&dgClass=" + dGClass +
                            "&truckStartTime=" + truckStartTime + "&truckHours=" + truckHours).then(function (response) {
                                return response.data;
                            });
                    },
                    rateJob: function (cid, fromId, toId, speed, pedal, van, returnJob, weight, size, includeFuelSurcharge, direct, acceptedJobTypeId,
                        ourRef, refA, refB, quantity, booked) {
                        return $http.get("job/RateJob?clientId=" + cid + "&fromId=" + fromId + "&toId=" + toId + "&speed=" + speed + "&pedal=" + pedal + "&van=" + van +
                            "&returnJob=" + returnJob + "&weight=" + weight + "&size=" + size + "&includeFuelSurcharge=" + includeFuelSurcharge + "&direct=" + direct +
                            "&acceptedJobTypeId=" + acceptedJobTypeId + "&ourRef=" + ourRef + "&refA=" + refA + "&refB=" + refB + "&quantity=" + quantity +
                            "&booked=" + booked).then(function (response) {
                            return response.data;
                        });
                    },
                    ppdExclusiveAmount: function(cid, amount) {
                        return $http.get("job/PPDExclusiveAmount?clientId=" + cid + "&amount=" + amount).then(
                            function(response) {
                                return response.data;
                            });
                    },
                    splitJob: function (jobId, despatcherName) {
                        return $http.post("job/splitJob?jobId=" + jobId+ "&despatcherName=" + despatcherName).then(function (response) {
                            return response;
                        });
                    },
                    reRateSplitJob: function (jobId) {
                        return $http.post("job/ReRateSplitJob?jobId=" + jobId).then(function (response) {
                            return response;
                        });
                    },
                    updateDeliveryAddress: function (jobId, toSuburbId, address, lat, lng, cbd, rate, despatcherName, prebook) {
                        var method = prebook ? "job/UpdateBookingDeliveryAddress" : "job/UpdateDeliveryAddress";
                        return $http.post(method + "?jobId=" + jobId + "&toSuburbId=" + toSuburbId + "&address=" + address + "&deliveryLat=" + lat + "&deliveryLng=" + lng + "&cbd=" + cbd + "&rate=" + rate + '&despatcherName=' + despatcherName).then(function (response) {
                            return response;
                        });
                    },
                    updatePickupAddress: function (jobId, fromSuburbId, address, lat, lng, cbd, rate, despatcherName, prebook) {
                        var method = prebook ? "job/UpdateBookingPickupAddress" : "job/UpdatePickupAddress";
                        return $http.post(method + "?jobId=" + jobId + "&fromSuburbId=" + fromSuburbId + "&address=" + address + "&pickupLat=" + lat + "&pickupLng=" + lng + "&cbd=" + cbd + "&rate=" + rate + '&despatcherName=' + despatcherName).then(function (response) {
                            return response;
                        });
                    },
                    updateSplitJobAddress: function (jobId, toSuburbId, address, lat, lng) {
                        return $http.post("job/UpdateSplitJobAddress?jobId=" + jobId + "&toSuburbId=" + toSuburbId + "&address=" + address + "&deliveryLat=" + lat + "&deliveryLng=" + lng).then(function (response) {
                            return response;
                        });
                    },
                    updateJobDetail: function (jobId, field, value, rate, despatcherName, staffId, preBook) {
                        if (field === "Time" || field === "CompletedTime") {
                            value = moment().format("YYYY-MM-DD") +
                                " " +
                                moment(value).format("HH:mm:ss");
                        }
                        if (field === "Date" || field === "StopDate" || field === "RestartDate" || field === "InActiveDate" || field === "FirstDue" || field === "LastDone" || field === "NextDue") {
                            value = moment(value).format("YYYY-MM-DD");
                        }
                        var method = preBook ? "job/UpdateJobBooking" : "job/UpdateJob";
                        return $http.post(method + "?jobId=" + jobId + "&field=" + field + "&value=" + value + "&rate=" + rate + '&despatcherName=' + despatcherName + '&staffId=' + staffId).then(function (response) {
                            return response;
                        });
                    },
                    doAPI: function (data) {
                        return $http.post("app/components/home/api/api.php", data).then(function (response) {
                            return response.data;
                        });


                    },
                    getNationwideJobsNew: function (data, selectedClients, internal) {
                        return $http.get("job/nationwideJobListNew?status=" + data.status + "&area=" + data.area + "&order=" + data.order + "&asc=" + data.asc + "&isInternal=" + internal + "&cid=" + ContactID + "&clientIds=" + selectedClients).then(function (response) {
                            return response.data;
                        });


                    },
                    getNationwideJobsPOD: function (data, selectedClients, internal) {
                        return $http.get("job/nationwideJobListPOD?status=" + data.status + "&area=" + data.area + "&order=" + data.order + "&asc=" + data.asc + "&isInternal=" + internal + "&cid=" + ContactID + "&clientIds=" + selectedClients).then(function (response) {
                            return response.data;
                        });


                    },
                    getNationwideJobsBookDelivery: function (data, selectedClients, internal) {
                        return $http.get("job/nationwideJobListBookDelivery?status=" + data.status + "&area=" + data.area + "&order=" + data.order + "&asc=" + data.asc + "&isInternal=" + internal + "&cid=" + ContactID + "&clientIds=" + selectedClients).then(function (response) {
                            return response.data;
                        });


                    },
                    getNationwideJobsReprice: function (data, selectedClients, internal) {
                        return $http.get("job/nationwideJobListReprice?status=" + data.status + "&area=" + data.area + "&order=" + data.order + "&asc=" + data.asc + "&isInternal=" + internal + "&cid=" + ContactID + "&clientIds=" + selectedClients).then(function (response) {
                            return response.data;
                        });


                    },
                    getEventTypes: function () {
                        return $http.get("job/EventTypeList").then(function (response) {
                            return response.data;
                        });
                    },
                };
            }
        ]);   