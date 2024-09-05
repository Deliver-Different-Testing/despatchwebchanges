<div ng-if="jobsCurrentList">

    <div class="table-headings">
        <table>
            <thead class="thead-dark no select">
            <tr>

                <th ng-click="orderList('jobsCurrentList', 'time')" scope="col">T <i class="fa fa-caret-down"
                                                                                     ng-if="sort.jobsCurrentList =='time'"></i><i
                        class="fa fa-caret-up" ng-if="sort.jobsCurrentList =='d-time'"></i></th>
                <th ng-click="orderList('jobsCurrentList', 'speed')" scope="col">Speed <i class="fa fa-caret-down"
                                                                                          ng-if="sort.jobsCurrentList =='speed'"></i><i
                        class="fa fa-caret-up" ng-if="sort.jobsCurrentList =='d-speed'"></i></th>
                <th ng-click="orderList('jobsCurrentList', 'notify')" scope="col">N <i class="fa fa-caret-down"
                                                                                       ng-if="sort.jobsCurrentList =='notify'"></i><i
                        class="fa fa-caret-up" ng-if="sort.jobsCurrentList =='d-notify'"></i></th>
                <th ng-click="orderList('jobsCurrentList', 'vehicle')" scope="col">V <i class="fa fa-caret-down"
                                                                                        ng-if="sort.jobsCurrentList =='vehicle'"></i><i
                        class="fa fa-caret-up" ng-if="sort.jobsCurrentList =='d-vehicle'"></i></th>
                <th ng-click="orderList('jobsCurrentList', 'jobNo')" scope="col">Job <i class="fa fa-caret-down"
                                                                                        ng-if="sort.jobsCurrentList =='jobNo'"></i><i
                        class="fa fa-caret-up" ng-if="sort.jobsCurrentList =='d-jobNo'"></i></th>
                <th ng-click="orderList('jobsCurrentList', 'client')" scope="col">Client <i class="fa fa-caret-down"
                                                                                            ng-if="sort.jobsCurrentList =='client'"></i><i
                        class="fa fa-caret-up" ng-if="sort.jobsCurrentList =='d-client'"></i></th>
                <th ng-click="orderList('jobsCurrentList', 'from')" scope="col">From <i class="fa fa-caret-down"
                                                                                        ng-if="sort.jobsCurrentList =='from'"></i><i
                        class="fa fa-caret-up" ng-if="sort.jobsCurrentList =='d-from'"></i></th>
                <th colspan="2" ng-click="orderList('jobsCurrentList', 'to')" scope="col">To <i class="fa fa-caret-down"
                                                                                                ng-if="sort.jobsCurrentList =='to'"></i><i
                        class="fa fa-caret-up" ng-if="sort.jobsCurrentList =='d-to'"></i></th>
                <th></th>
                <th ng-click="orderList('jobsCurrentList', 'remain')" scope="col">Remain <i class="fa fa-caret-down"
                                                                                            ng-if="sort.jobsCurrentList =='remain'"></i><i
                        class="fa fa-caret-up" ng-if="sort.jobsCurrentList =='d-remain'"></i></th>
                <th ng-click="orderList('jobsCurrentList', 'status')" scope="col">S <i class="fa fa-caret-down"
                                                                                       ng-if="sort.jobsCurrentList =='status'"></i><i
                        class="fa fa-caret-up" ng-if="sort.jobsCurrentList =='d-status'"></i></th>
                <th ng-click="orderList('jobsCurrentList', 'lp')" scope="col">LP <i class="fa fa-caret-down"
                                                                                    ng-if="sort.jobsCurrentList =='lp'"></i><i
                        class="fa fa-caret-up" ng-if="sort.jobsCurrentList =='d-lp'"></i></th>
                <th ng-click="orderList('jobsCurrentList', 'ld')" scope="col">LD <i class="fa fa-caret-down"
                                                                                    ng-if="sort.jobsCurrentList =='ld'"></i><i
                        class="fa fa-caret-up" ng-if="sort.jobsCurrentList =='d-ld'"></i></th>
                <th ng-click="orderList('jobsCurrentList', 'runOrder')" scope="col">RO <i class="fa fa-caret-down"
                                                                                          ng-if="sort.jobsCurrentList =='runOrder'"></i><i
                        class="fa fa-caret-up" ng-if="sort.jobsCurrentList =='d-runOrder'"></i></th>
                <th></th>

            </tr>
            </thead>
        </table>


    </div>

    <table class="table table-striped table-responsive table-rows" data-group="currentWork" id="currentWork">
        <thead class="thead-dark no select">
        </thead>

        <tbody>
        <tr class="droppable-row draggable-row clickable-row noselect"
            data-courier="{{job.courier}}" data-jobNo="{{job.jobNo}}"
            data-jobid="{{job.id}}" ng-click="selectJob(job);"
            ng-repeat="job in jobsCurrentList | filter: box.searchBox">

            <td>{{job.time | date: "HH:mm"}}</td>
            <td style="min-width:30px;" right-click action="speedColumnClick(event)">{{job.speed}}</td>
            <td action="notifyColumnClick(event)" ng-if="job.courierData.courierID === null" right-click>
                {{job.notify}}
            </td>
            <td style="min-width:30px;" ng-if="job.courierData.courierID !== null">{{job.notify}}</td>
            <td>
                <div style="width:25px; white-space:nowrap; overflow-x:hidden;" title="{{job.vehicle.label}}">
                    {{job.vehicle.label}}
                </div>
            </td>
            <td style="min-width:80px;" context-menu="setEventsMenu">{{job.jobNo}}</td>
            <td style="width:55px;" right-click action="clientColumnClick(event)">{{job.client}}</td>
            <td action="fromColumnClick(event)" right-click style="width:50px; white-space:nowrap; overflow-x:hidden;">
                {{job.from}} <i class="fa fa-exclamation" ng-if="!job.pickUpLongitude"></i></td>
            <td context-menu="setCurrentWorkMenu">
                <div action="toColumnClick(event)" right-click
                     style="width:450px; white-space:nowrap; overflow-x:hidden;" title="{{job.toAddress}}"><i
                        class="fa fa-exclamation" ng-if="!job.deliveryLongitude"></i>{{job.to}} {{job.toAddress}}
                </div>
            </td>
            <td><input class="dispatchField" ng-model="job.courier" ng-readonly="job.courierData.courierID !== null"
                       ng-style="getJobStyle(job.courierData.courierID !== null)" placeholder=""
                       type="text"/></td>
            <td context-menu="setCurrentWorkMenu"><span
                    ng-style='{"color":"darkorange", "font-weight": "bold"}'>{{job.remain}}</span></td>
            <td class="status" ng-class="job.status">{{job.status}}</td>
            <td><input class="lateCallField" ng-focus="selectAllContent($event)"
                       ng-keydown="$event.keyCode === 13 && latePickup(job.lp, job, this)"
                       ng-model="job.lp" ng-mouseup="$event.preventDefault();"
                       placeholder="LP" type="text"/></td>
            <td><input class="lateCallField" ng-focus="selectAllContent($event)" ng-keydown="$event.keyCode === 13 && lateDelivery(job.ld, job, this)"
                       ng-model="job.ld" ng-mouseup="$event.preventDefault();"
                       placeholder="LD" type="text"/></td>
            <td>{{job.runOrder}}</td>
            <td class="selectjob" ng-click="selectForDispatch(job); $event.stopPropagation();"
                style="display:none" title="placeholder selector"></td>
        </tr>
        <tr>

            <td>
                <div></div>
            </td>
            <td>
                <div></div>
            </td>
            <td>
                <div></div>
            </td>
            <td>
                <div></div>
            </td>
            <td>
                <div></div>
            </td>
            <td>
                <div></div>
            </td>
            <td>
                <div></div>
            </td>
            <td colspan="2">
                <div></div>
            </td>
            <td>
                <div></div>
            </td>
            <td>
                <div></div>
            </td>
            <td>
                <div></div>
            </td>
            <td>
                <div style="width:12px;"></div>
            </td>
            <td>
                <div style="width:12px;"></div>
            </td>
            <td>
                <div></div>
            </td>

        </tr>
        </tbody>
    </table>

</div>

<div class="no-data" ng-if="!jobsCurrentList">
    <div class="text">Please select a courier</div>
</div>

<div class="loading">
    <div class="text">
        <md-progress-circular md-mode="indeterminate"></md-progress-circular>
        <span class="sr-only">Loading...</span>
    </div>
</div>

<script>
    angular.element(".box-content").on("scroll", function () {
        const newTop = angular.element(this).scrollTop();
        angular.element(this).find(".table-headings").css({"top": newTop});
    });
</script>
