<div class="table-headings">
    <table>
        <thead class="thead-dark no select">
        <tr>
            <th ng-click="orderList('jobList','time')" scope="col"><i class="material-symbols-outlined job-table-icon"
                                                                      ng-if="sort.jobList == 'time'">arrow_drop_down</i><i
                    class="material-symbols-outlined job-table-icon"
                    ng-if="sort.jobList == 'd-status'">arrow_drop_up</i>Time
            </th>
            <th ng-click="orderList('jobList','speed')" scope="col"><i class="material-symbols-outlined job-table-icon"
                                                                       ng-if="sort.jobList == 'speed'">arrow_drop_down</i><i
                    class="material-symbols-outlined job-table-icon"
                    ng-if="sort.jobList == 'd-time'">arrow_drop_up</i>Speed
            </th>
            <th ng-click="orderList('jobList', 'jobno')" scope="col"><i class="material-symbols-outlined job-table-icon"
                                                                        ng-if="sort.jobList == 'jobno'">arrow_drop_down</i><i
                    class="material-symbols-outlined job-table-icon"
                    ng-if="sort.jobList == 'd-speed'">arrow_drop_up</i>Job No
            </th>
            <th ng-click="orderList('jobList','client')" scope="col"><i class="material-symbols-outlined job-table-icon"
                                                                        ng-if="sort.jobList == 'client'">arrow_drop_down</i><i
                    class="material-symbols-outlined job-table-icon"
                    ng-if="sort.jobList == 'd-notify'">arrow_drop_up</i>Client
            </th>
            <th ng-click="orderList('jobList','from')" scope="col"><i class="material-symbols-outlined job-table-icon"
                                                                      ng-if="sort.jobList == 'from'">arrow_drop_down</i><i
                    class="material-symbols-outlined job-table-icon"
                    ng-if="sort.jobList == 'd-from'">arrow_drop_up</i>From
            </th>
            <th ng-click="orderList('jobList','to')" scope="col"><i class="material-symbols-outlined job-table-icon"
                                                                    ng-if="sort.jobList == 'to'">arrow_drop_down</i><i
                    class="material-symbols-outlined job-table-icon" ng-if="sort.jobList == 'd-to'">arrow_drop_up</i>To
            </th>
            <th ng-click="orderList('jobList','courier')" scope="col"><i
                    class="material-symbols-outlined job-table-icon"
                    ng-if="sort.jobList == 'courier'">arrow_drop_down</i><i
                    class="material-symbols-outlined job-table-icon"
                    ng-if="sort.jobList == 'd-courier'">arrow_drop_up</i>Courier
            </th>
            <th ng-click="orderList('jobList','pod')" scope="col"><i class="material-symbols-outlined job-table-icon"
                                                                     ng-if="sort.jobList == 'pod'">arrow_drop_down</i><i
                    class="material-symbols-outlined job-table-icon" ng-if="sort.jobList == 'd-pod'">arrow_drop_up</i>POD
            </th>
            <th ng-click="orderList('jobList','remain')" scope="col"><i class="material-symbols-outlined job-table-icon"
                                                                        ng-if="sort.jobList == 'remain'">arrow_drop_down</i><i
                    class="material-symbols-outlined job-table-icon"
                    ng-if="sort.jobList == 'd-remain'">arrow_drop_up</i>Remain
            </th>
            <th ng-click="orderList('jobList','status')" scope="col"><i class="material-symbols-outlined job-table-icon"
                                                                        ng-if="sort.jobList == 'status'">arrow_drop_down</i><i
                    class="material-symbols-outlined job-table-icon"
                    ng-if="sort.jobList == 'd-status'">arrow_drop_up</i>S
            </th>
            <th></th>
            <th style="width:20px;">E</th>
            <th style="width:20px;">R</th>
        </tr>
        </thead>
    </table>

</div>


<table class="table  table-responsive table-rows" data-group="jobsGroup" id="jobList">
    <tbody>
    <tr class="clickable-row draggable-row noselect status" data-allowDispatch="{{job.allowDispatch}}"
        data-courier="{{job.courier}}" data-index="{{$index}}" data-jobid="{{job.id}}"
        data-jobno="{{job.jobNo}}" ng-mouseup="selectJob(job)" ng-repeat="job in jobList | filter: box.searchBox">
        <td>{{job.time | date: "HH:mm"}}</td>
        <td action="speedColumnClick(event)" right-click>{{job.speed}}</td>
        <td context-menu="setEventsMenu">{{job.jobNo}}</td>
        <td action="clientColumnClick(event)" right-click>{{job.client}}</td>
        <td action="fromColumnClick(event)" right-click style="width:50px; white-space:nowrap; overflow-x:hidden;">
            {{job.from}}
        </td>
        <td action="toColumnClick(event)" right-click>{{job.to}}</div></td>
        <td><input class="dispatchField" ng-keydown="$event.keyCode === 13 && dispatchJobsFromNew(job.courier)" ng-model="job.courier"
                   ng-readonly="job.courierData.courierID !== null" ng-style="getJobStyle(job.courierData.courierID !== null)"
                   placeholder="" type="text"/></td>
        <td>{{job.pod}}</td>
        <td><span ng-style='{"color":"darkorange", "font-weight": "bold"}'>{{job.remain}}</span></td>
        <td class="status" ng-class="job.status">{{job.status}}</td>
        <td class="selectjob" ng-click="selectForDispatch(job); $event.stopPropagation();" style="display:none"
            title="placeholder selector"></td>
        <td ng-click="createEvent();" style="width:20px;" title="Create Event"><i
                class="material-symbols-outlined job-table-icon">calendar_add_on</i>
        </td>
        <td ng-click="job.courier == null || restoreJobsFromNew();" style="width:20px;" title="Restore"><i
                class="material-symbols-outlined job-table-icon" ng-if="job.courier !== null">undo</i></td>

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
