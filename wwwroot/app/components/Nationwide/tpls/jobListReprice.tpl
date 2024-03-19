

    <div class="table-headings">
        <table>
            <thead class="thead-dark no select">
            <tr>
                <th scope="col" ng-click="orderList('jobList','time')"><i class="fa fa-caret-down" ng-show="sort.jobList == 'time'"></i><i class="fa fa-caret-up" ng-show="sort.jobList == 'd-status'"></i>Time </th>
				<th scope="col" ng-click="orderList('jobList','speed')"><i class="fa fa-caret-down" ng-show="sort.jobList == 'speed'"></i><i class="fa fa-caret-up" ng-show="sort.jobList == 'd-time'"></i>Speed </th>
                <th scope="col" ng-click="orderList('jobList', 'jobno')"><i class="fa fa-caret-down" ng-show="sort.jobList == 'jobno'"></i><i class="fa fa-caret-up" ng-show="sort.jobList == 'd-speed'"></i>Job No </th>
                <th scope="col" ng-click="orderList('jobList','client')"><i class="fa fa-caret-down" ng-show="sort.jobList == 'client'"></i><i class="fa fa-caret-up" ng-show="sort.jobList == 'd-notify'"></i>Client </th>
                <th scope="col" ng-click="orderList('jobList','from')"><i class="fa fa-caret-down" ng-show="sort.jobList == 'from'"></i><i class="fa fa-caret-up" ng-show="sort.jobList == 'd-from'"></i>From </th>
				<th scope="col" ng-click="orderList('jobList','to')"><i class="fa fa-caret-down" ng-show="sort.jobList == 'to'"></i><i class="fa fa-caret-up" ng-show="sort.jobList == 'd-to'"></i>To </th>
                <th scope="col" ng-click="orderList('jobList','courier')"><i class="fa fa-caret-down" ng-show="sort.jobList == 'courier'"></i><i class="fa fa-caret-up" ng-show="sort.jobList == 'd-courier'"></i>Courier </th>
                <th scope="col" ng-click="orderList('jobList','pod')"><i class="fa fa-caret-down" ng-show="sort.jobList == 'pod'"></i><i class="fa fa-caret-up" ng-show="sort.jobList == 'd-pod'"></i>POD </th>
                <th scope="col" ng-click="orderList('jobList','remain')"><i class="fa fa-caret-down" ng-show="sort.jobList == 'remain'"></i><i class="fa fa-caret-up" ng-show="sort.jobList == 'd-remain'"></i>Remain</th>
                <th scope="col" ng-click="orderList('jobList','status')"><i class="fa fa-caret-down" ng-show="sort.jobList == 'status'"></i><i class="fa fa-caret-up" ng-show="sort.jobList == 'd-status'"></i>S </th
                <th></th>
                <th style="width:20px;">E</th>
                <th style="width:20px;">R</th>
            </tr>
            </thead>
        </table>

    </div>


    <table class="table  table-responsive table-rows" id="jobListReprice" data-group="jobsGroup">
        <tbody>
        <tr class="clickable-row draggable-row noselect" ng-class="job.direct ? 'direct' : ''" ng-repeat="job in jobListReprice | filter: box.searchBox"  data-courier="{{job.courier}}" data-jobid="{{job.id}}" data-jobno="{{job.jobNo}}" data-allowDispatch="{{job.allowDispatch}}" data-index="{{$index}}" ng-mouseup="selectJob(job, true)">
		    <td>{{job.time | date : "HH:mm"}}</td>	
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


<div class="loading" style="display:block">
    <div class="text">
        <i class="fa fa-refresh fa-spin fa-3x fa-fw"></i>
        <span class="sr-only">Loading...</span>
    </div>
</div>

<script>

    $(".box-content").on("scroll", function() {
        var newTop = $(this).scrollTop();
        $(this).find(".table-headings").css({"top":newTop});
    });

</script>