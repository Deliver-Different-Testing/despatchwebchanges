<div ng-if="jobsCurrentList">

<div class="table-headings">
    <table>
        <thead class="thead-dark no select">
        <tr>
        
        <th scope="col" ng-click="orderList('jobsCurrentList', 'time')">T <i class="fa fa-caret-down" ng-show="sort.jobsCurrentList =='time'"></i><i class="fa fa-caret-up" ng-show="sort.jobsCurrentList =='d-time'"></i></th>
		<th scope="col" ng-click="orderList('jobsCurrentList', 'speed')">Speed <i class="fa fa-caret-down" ng-show="sort.jobsCurrentList =='speed'"></i><i class="fa fa-caret-up" ng-show="sort.jobsCurrentList =='d-speed'"></i></th>
        <th scope="col" ng-click="orderList('jobsCurrentList', 'notify')">N <i class="fa fa-caret-down" ng-show="sort.jobsCurrentList =='notify'"></i><i class="fa fa-caret-up" ng-show="sort.jobsCurrentList =='d-notify'"></i></th>
        <th scope="col" ng-click="orderList('jobsCurrentList', 'vehicle')">V <i class="fa fa-caret-down" ng-show="sort.jobsCurrentList =='vehicle'"></i><i class="fa fa-caret-up" ng-show="sort.jobsCurrentList =='d-vehicle'"></i></th>
        <th scope="col" ng-click="orderList('jobsCurrentList', 'jobNo')">Job <i class="fa fa-caret-down" ng-show="sort.jobsCurrentList =='jobNo'"></i><i class="fa fa-caret-up" ng-show="sort.jobsCurrentList =='d-jobNo'"></i></th>
        <th scope="col" ng-click="orderList('jobsCurrentList', 'client')">Client <i class="fa fa-caret-down" ng-show="sort.jobsCurrentList =='client'"></i><i class="fa fa-caret-up" ng-show="sort.jobsCurrentList =='d-client'"></i></th>
        <th scope="col" ng-click="orderList('jobsCurrentList', 'from')">From <i class="fa fa-caret-down" ng-show="sort.jobsCurrentList =='from'"></i><i class="fa fa-caret-up" ng-show="sort.jobsCurrentList =='d-from'"></i></th>
        <th colspan="2" scope="col" ng-click="orderList('jobsCurrentList', 'to')">To <i class="fa fa-caret-down" ng-show="sort.jobsCurrentList =='to'"></i><i class="fa fa-caret-up" ng-show="sort.jobsCurrentList =='d-to'"></i></th>
		<!--<th scope="col" ng-click="orderList('jobsCurrentList','to')">Street <i class="fa fa-caret-down" ng-show="sort.jobsCurrentList == 'to'"></i><i class="fa fa-caret-up" ng-show="sort.jobsCurrentList == 'd-to'"></i></th>-->
        <th></th>
        <th scope="col" ng-click="orderList('jobsCurrentList', 'remain')">Remain <i class="fa fa-caret-down" ng-show="sort.jobsCurrentList =='remain'"></i><i class="fa fa-caret-up" ng-show="sort.jobsCurrentList =='d-remain'"></i></th>
        <th scope="col" ng-click="orderList('jobsCurrentList', 'status')">S <i class="fa fa-caret-down" ng-show="sort.jobsCurrentList =='status'"></i><i class="fa fa-caret-up" ng-show="sort.jobsCurrentList =='d-status'"></i></th>
        <th scope="col" ng-click="orderList('jobsCurrentList', 'lp')">LP <i class="fa fa-caret-down" ng-show="sort.jobsCurrentList =='lp'"></i><i class="fa fa-caret-up" ng-show="sort.jobsCurrentList =='d-lp'"></i></th>
        <th scope="col" ng-click="orderList('jobsCurrentList', 'ld')">LD <i class="fa fa-caret-down" ng-show="sort.jobsCurrentList =='ld'"></i><i class="fa fa-caret-up" ng-show="sort.jobsCurrentList =='d-ld'"></i></th>
        <th scope="col" ng-click="orderList('jobsCurrentList', 'runOrder')">RO <i class="fa fa-caret-down" ng-show="sort.jobsCurrentList =='runOrder'"></i><i class="fa fa-caret-up" ng-show="sort.jobsCurrentList =='d-runOrder'"></i></th>
        <th scope="col" ng-click="orderList('jobsCurrentList', 'ct')">CT <i class="fa fa-caret-down" ng-show="sort.jobsCurrentList =='ct'"></i><i class="fa fa-caret-up" ng-show="sort.jobsCurrentList =='d-ct'"></i></th>
        <th></th>
        
        </tr>
        </thead>
    </table>


</div>

<table class="table table-striped table-responsive table-rows" id="currentWork" data-group="currentWork">
    <thead class="thead-dark no select">

    </tr>
    </thead>
    <tbody>
    <tr class="droppable-row draggable-row clickable-row noselect" ng-repeat="job in jobsCurrentList | filter: box.searchBox"  ng-click="selectJobDetail(job);" data-courier="{{job.courier}}" data-jobid="{{job.id}}" data-jobNo="{{job.jobNo}}">
            
		    <td>{{job.time | date : "HH:mm"}}</td>
            <td style="min-width:30px;" right-click action="speedColumnClick(event)">{{job.speed}}</td>
            <td ng-if="job.courierData.courierID === null" right-click action="notifyColumnClick(event)">{{job.notify}}</td>
            <td style="min-width:30px;" ng-if="job.courierData.courierID !== null">{{job.notify}}</td>
            <td><div style="width:25px; white-space:nowrap; overflow-x:hidden;" title="{{job.vehicle.label}}">{{job.vehicle.label}}</div></td>
            <td style="min-width:80px;" context-menu="setEventsMenu">{{job.jobNo}}</td>
            <td style="width:55px;" right-click action="clientColumnClick(event)">{{job.client}}</td>
            <td style="width:50px; white-space:nowrap; overflow-x:hidden;" right-click action="fromColumnClick(event)">{{job.from}} <i ng-if="!job.pickUpLongitude" class="fa fa-exclamation"></i></td>
			<!-- <td right-click action="toColumnClick(event)">{{job.to}} <i ng-if="!job.deliveryLongitude" class="fa fa-exclamation"></i></td>-->
			<td context-menu="setCurrentWorkMenu"><div right-click action="toColumnClick(event)" style="width:450px; white-space:nowrap; overflow-x:hidden;" title="{{job.toAddress}}"><i ng-if="!job.deliveryLongitude"  class="fa fa-exclamation"></i>{{job.to}} {{job.toAddress}}</div></td>
            <td><input type="text" class="dispatchField" ng-readonly="job.courierData.courierID !== null" ng-style="getJobStyle(job.courierData.courierID !== null)" ng-model="job.courier"  placeholder="" /></td>
            <td context-menu="setCurrentWorkMenu"><span ng-style='{"color":"darkorange", "font-weight": "bold"}'>{{job.remain}}</span></td>
            <td class="status" ng-class="job.status">{{job.status}}</td>
            <td><input type="text" class="lateCallField" ng-focus="selectAllContent($event)" ng-mouseup="$event.preventDefault();"  ng-model="job.lp" ng-keydown="$event.keyCode === 13 && latePickup(job.lp, job, $this)"  placeholder="LP" /></td>
			<td><input type="text" class="lateCallField" ng-focus="selectAllContent($event)" ng-mouseup="$event.preventDefault();" ng-model="job.ld" ng-keydown="$event.keyCode === 13 && lateDelivery(job.ld, job, this)"  placeholder="LD" /></td>
            <td>{{job.runOrder}}</td>
            <td>{{job.completedTime | date: "HH:mm"}}</td>
            <td class="selectjob" ng-click="selectForDispatch(job); $event.stopPropagation();" title="placeholder selector" style="display:none"></td>
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
            <td><div></div></td>
            <td><div style="width:12px;"></div></td>
            <td><div style="width:12px;"></div></td>
            <td><div></div></td>
            <td><div></div></td>
            
        </tr>
    </tbody>
</table>

</div>

<div class="no-data" ng-if="!jobsCurrentList">
    <div class="text">Please select a courier</div>
</div>

<div class="loading">
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