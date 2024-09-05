

    <div class="table-headings">
        <table>
            <thead class="thead-dark no select">
            <tr>
                <th ng-click="orderList('jobList','time')" scope="col"><i class="fa fa-caret-down"
                                                                          ng-if="sort.jobList == 'time'"></i><i
                        class="fa fa-caret-up" ng-if="sort.jobList == 'd-status'"></i>Time
                </th>
                <th ng-click="orderList('jobList','speed')" scope="col"><i class="fa fa-caret-down"
                                                                           ng-if="sort.jobList == 'speed'"></i><i
                        class="fa fa-caret-up" ng-if="sort.jobList == 'd-time'"></i>Speed
                </th>
                <th ng-click="orderList('jobList', 'jobno')" scope="col"><i class="fa fa-caret-down"
                                                                            ng-if="sort.jobList == 'jobno'"></i><i
                        class="fa fa-caret-up" ng-if="sort.jobList == 'd-speed'"></i>Job No
                </th>
                <th ng-click="orderList('jobList','client')" scope="col"><i class="fa fa-caret-down"
                                                                            ng-if="sort.jobList == 'client'"></i><i
                        class="fa fa-caret-up" ng-if="sort.jobList == 'd-notify'"></i>Client
                </th>
                <th ng-click="orderList('jobList','from')" scope="col"><i class="fa fa-caret-down"
                                                                          ng-if="sort.jobList == 'from'"></i><i
                        class="fa fa-caret-up" ng-if="sort.jobList == 'd-from'"></i>From
                </th>
                <th ng-click="orderList('jobList','to')" scope="col"><i class="fa fa-caret-down"
                                                                        ng-if="sort.jobList == 'to'"></i><i
                        class="fa fa-caret-up" ng-if="sort.jobList == 'd-to'"></i>To
                </th>
                <th ng-click="orderList('jobList','courier')" scope="col"><i class="fa fa-caret-down"
                                                                             ng-if="sort.jobList == 'courier'"></i><i
                        class="fa fa-caret-up" ng-if="sort.jobList == 'd-courier'"></i>Courier
                </th>
                <th ng-click="orderList('jobList','pod')" scope="col"><i class="fa fa-caret-down"
                                                                         ng-if="sort.jobList == 'pod'"></i><i
                        class="fa fa-caret-up" ng-if="sort.jobList == 'd-pod'"></i>POD
                </th>
                <th ng-click="orderList('jobList','remain')" scope="col"><i class="fa fa-caret-down"
                                                                            ng-if="sort.jobList == 'remain'"></i><i
                        class="fa fa-caret-up" ng-if="sort.jobList == 'd-remain'"></i>Remain
                </th>
                <th ng-click="orderList('jobList','status')" scope="col"><i class="fa fa-caret-down"
                                                                            ng-if="sort.jobList == 'status'"></i><i
                        class="fa fa-caret-up" ng-if="sort.jobList == 'd-status'"></i>S
                </th>
                <th></th>
                <th style="width:20px;">E</th>
                <th style="width:20px;">R</th>
            </tr>
            </thead>
        </table>

    </div>


    <table class="table  table-responsive table-rows" id="jobListReprice" data-group="jobsGroup">
        <tbody>
        <tr class="clickable-row draggable-row noselect" data-allowDispatch="{{job.allowDispatch}}"
            data-courier="{{job.courier}}" data-index="{{$index}}"
            data-jobid="{{job.id}}" data-jobno="{{job.jobNo}}" ng-class="job.direct ? 'direct' : ''"
            ng-mouseup="selectJob(job)" ng-repeat="job in jobListReprice | filter: box.searchBox">
            <td>{{job.time | date: "HH:mm"}}</td>
            <td right-click action="speedColumnClick(event)">{{job.speed}}</td>
			<td context-menu="setEventsMenu">{{job.jobNo}}</td>
			<td right-click action="clientColumnClick(event)">{{job.client}}</td>
            <td style="width:50px; white-space:nowrap; overflow-x:hidden;" right-click action="fromColumnClick(event)">{{job.from}}</td>
			<td right-click action="toColumnClick(event)">{{job.to}}</div></td>
            <td><input type="text" class="dispatchField" ng-readonly="job.courierData.courierID !== null" ng-style="getJobStyle(job.courierData.courierID !== null)" ng-model="job.courier" ng-keydown="$event.keyCode === 13 && dispatchJobs(job.courier)" placeholder="" /></td>
            <td>{{job.pod}}</td>
            <td><span ng-style='{"color":"darkorange", "font-weight": "bold"}'>{{job.remain}}</span></td>
            <td class="status" ng-class="job.status">{{job.status}}</td>
			<td class="selectjob" ng-click="selectForDispatch(job); $event.stopPropagation();" title="placeholder selector" style="display:none"></td>
            <td style="width:20px;"  ng-click="createEvent();" title="Create Event"><i class="fa fa-calendar-plus-o"></i></td>
            <td style="width:20px;" ng-click="job.courier == null || restoreJobsFromReprice();" title="Restore"><i ng-if="job.courier !== null" class="fa fa-undo"></i></td>

        </tr>
        <tr>
            <td><div></div></td>
            <td><div></div></td>
			<td><div></div></td>
            <td><div></div></td>
            <td><div></div></td>
            <td><div></div></td>
            <td><div></div></td>
			<td><div></div></td>
			<td><div></div></td>
            <td><div></div></td>
            <td><div></div></td>
            <td><div></div></td>
            <td><div></div></td>

        </tr>
        </tbody>
    </table>

    <div class="loading">
        <div class="text">
            <md-progress-circular md-mode="indeterminate"></md-progress-circular>
            <span class="sr-only">Loading...</span>
        </div>
    </div>

<script>
    angular.element(".box-content").on("scroll", function () {
        var newTop = angular.element(this).scrollTop();
        angular.element(this).find(".table-headings").css({"top": newTop});
    });
</script>
