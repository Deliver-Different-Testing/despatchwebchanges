

    <div class="table-headings">
        <table>
            <thead class="thead-dark no select">
            <tr>
				<th scope="col" ng-click="orderList('jobList','time')"><i class="fa fa-caret-down" ng-show="sort.jobList == 'time'"></i><i class="fa fa-caret-up" ng-show="sort.jobList == 'd-time'"></i>T </th>
                <th scope="col" ng-click="orderList('jobList', 'speed')"><i class="fa fa-caret-down" ng-show="sort.jobList == 'speed'"></i><i class="fa fa-caret-up" ng-show="sort.jobList == 'd-speed'"></i>Speed </th>
                <th scope="col" ng-click="orderList('jobList','notify')"><i class="fa fa-caret-down" ng-show="sort.jobList == 'notify'"></i><i class="fa fa-caret-up" ng-show="sort.jobList == 'd-notify'"></i>N </th>
                <th scope="col" ng-click="orderList('jobList','vehicle')"><i class="fa fa-caret-down" ng-show="sort.jobList == 'vehicle'"></i><i class="fa fa-caret-up" ng-show="sort.jobList == 'd-vehicle'"></i>V </th>
                <th scope="col" ng-click="orderList('jobList','jobNo')"><i class="fa fa-caret-down" ng-show="sort.jobList == 'jobNo'"></i><i class="fa fa-caret-up" ng-show="sort.jobList == 'd-jobNo'"></i>Job </th>
                <th scope="col" ng-click="orderList('jobList','client')"><i class="fa fa-caret-down" ng-show="sort.jobList == 'client'"></i><i class="fa fa-caret-up" ng-show="sort.jobList == 'd-client'"></i>Client </th>
                <th scope="col" ng-click="orderList('jobList','from')"><i class="fa fa-caret-down" ng-show="sort.jobList == 'from'"></i><i class="fa fa-caret-up" ng-show="sort.jobList == 'd-from'"></i>From </th>
				<th colspan="2" scope="col" ng-click="orderList('jobList','to')"><i class="fa fa-caret-down" ng-show="sort.jobList == 'to'"></i><i class="fa fa-caret-up" ng-show="sort.jobList == 'd-to'"></i>To </th>
				<!--<th scope="col" ng-click="orderList('jobList','to')">Street <i class="fa fa-caret-down" ng-show="sort.jobList == 'to'"></i><i class="fa fa-caret-up" ng-show="sort.jobList == 'd-to'"></i></th>-->
                
                <th></th>
                <th scope="col" ng-click="orderList('jobList','remain')"><i class="fa fa-caret-down" ng-show="sort.jobList == 'remain'"></i><i class="fa fa-caret-up" ng-show="sort.jobList == 'd-remain'"></i>Remain</th>
                <th scope="col" ng-click="orderList('jobList','status')"><i class="fa fa-caret-down" ng-show="sort.jobList == 'status'"></i><i class="fa fa-caret-up" ng-show="sort.jobList == 'd-status'"></i>S </th>
                <th></th>
                <th></th>
                <th>R</th>
                <th>RD</th>
            </tr>
            </thead>
        </table>

    </div>


    <table class="table  table-responsive table-rows" id="jobList" data-group="jobsGroup">
        <tbody>
        <tr class="clickable-row draggable-row noselect" ng-class="jobClass(job)" ng-repeat="job in jobList | filter: box.searchBox"  data-courier="{{job.courier}}" data-jobid="{{job.id}}" data-jobno="{{job.jobNo}}" data-allowDispatch="{{job.allowDispatch}}" data-index="{{$index}}" ng-mouseup="job.courier == null ? selectJob(job, false): selectJob(job, true)">
			<td>{{job.time | date : "HH:mm"}}</td>
			<td right-click action="speedColumnClick(event)">{{job.speed}}</td>
			<td ng-if="job.courierData.courierID === null" right-click action="notifyColumnClick(event)">{{job.notify}}</td>
            <td ng-if="job.courierData.courierID !== null">{{job.notify}}</td>
            <td><div style="width:25px; white-space:nowrap; overflow-x:hidden;" title="{{attention(job)}}">{{attention(job)}}</div></td>
			<td context-menu="setEventsMenu">{{job.jobNo}}</td>
			<td right-click action="clientColumnClick(event)">{{job.client}}</td>
			<td style="width:50px; white-space:nowrap; overflow-x:hidden;" right-click action="fromColumnClick(event)">{{job.from}} <i ng-if="!job.pickUpLongitude" class="fa fa-exclamation"></i></td>
			<td colspan="2"title="{{job.toAddress}}"><div right-click action="toColumnClick(event)" style="width:450px; white-space:nowrap; overflow-x:hidden;" title="{{job.toAddress}}"><i ng-if="!job.deliveryLongitude"  class="fa fa-exclamation"></i>{{job.to}} {{job.toAddress}}</div></td>
			<!--<td><div style="width:280px; white-space:nowrap; overflow-x:hidden;" title="{{job.toAddress}}">{{job.toAddress}}</div></td>	-->
			<td><input type="text" class="dispatchField" ng-readonly="job.courierData.courierID !== null" ng-style="getJobStyle(job.courierData.courierID !== null)" ng-model="job.courier" ng-keydown="$event.keyCode === 13 && dispatchJobs(job.courier)" placeholder="" /></td>
            <td><span ng-style='{"color":"darkorange", "font-weight": "bold"}'>{{job.remain}}</span></td>
            <td class="status" ng-class="job.status">{{job.status}}</td>
			<td><input type="text" /*right-click action="latePickColumnClick(event)"*/ class="lateCallField" ng-focus="selectAllContent($event)" ng-mouseup="$event.preventDefault();"  ng-model="job.lp" ng-keydown="$event.keyCode === 13 && latePickup(job.lp, job, $this)"  placeholder="LP" /></td>
			<td><input type="text" class="lateCallField" ng-focus="selectAllContent($event)" ng-mouseup="$event.preventDefault();" ng-model="job.ld" ng-keydown="$event.keyCode === 13 && lateDelivery(job.ld, job, this)"  placeholder="LD" /></td>
			<td class="selectjob" ng-click="selectForDispatch(job); $event.stopPropagation();" title="placeholder selector" style="display:none"></td>
            <td ng-click="job.courier == null || restoreJobs();" title="Restore"><i ng-if="job.courier !== null" class="fa fa-undo"></i></td>
            <td ng-click="job.courier == null || reAllocateJobs();" title="ReDispatch"><i ng-if="job.courier !== null" class="fa fa-repeat"></i></td>

        </tr>
        <tr>
            
            <td><div></div></td>
			<td><div></div></td>
            <td><div></div></td>
            <td><div></div></td>
            <td><div></div></td>
            <td><div></div></td>
			<td><div></div></td>
			<td colspan="2"><div></div></td>
			<td><div></div></td>
            <td><div></div></td>
            <td><div style="width:12px;"></div></td>
            <td><div style="width:12px;"></div></td>
            <td><div></div></td>
            <td><div></div></td>
            <td><div></div></td>
        </tr>
        </tbody>
    </table>


<div class="loading" style="display:none">
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