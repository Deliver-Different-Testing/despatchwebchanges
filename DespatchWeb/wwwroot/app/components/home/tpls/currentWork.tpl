<div ng-if="jobsCurrentList">

<div class="table-headings">
    <table>
        <thead class="thead-dark no select">
        <tr>
        <th scope="col" ng-click="orderList('jobsCurrentList', 'status')">S <i class="fa fa-caret-down" ng-show="sort.jobsCurrentList =='status'"></i><i class="fa fa-caret-up" ng-show="sort.jobsCurrentList =='d-status'"></i></th>
        <th scope="col" ng-click="orderList('jobsCurrentList', 'remain')">R <i class="fa fa-caret-down" ng-show="sort.jobsCurrentList =='remain'"></i><i class="fa fa-caret-up" ng-show="sort.jobsCurrentList =='d-remain'"></i></th>
		<th scope="col" ng-click="orderList('jobsCurrentList', 'speed')">Speed <i class="fa fa-caret-down" ng-show="sort.jobsCurrentList =='speed'"></i><i class="fa fa-caret-up" ng-show="sort.jobsCurrentList =='d-speed'"></i></th>
        <th scope="col" ng-click="orderList('jobsCurrentList', 'notify')">N <i class="fa fa-caret-down" ng-show="sort.jobsCurrentList =='notify'"></i><i class="fa fa-caret-up" ng-show="sort.jobsCurrentList =='d-notify'"></i></th>
        <th scope="col" ng-click="orderList('jobsCurrentList', 'jobNo')">Job <i class="fa fa-caret-down" ng-show="sort.jobsCurrentList =='jobNo'"></i><i class="fa fa-caret-up" ng-show="sort.jobsCurrentList =='d-jobNo'"></i></th>
        <th scope="col" ng-click="orderList('jobsCurrentList', 'client')">Client <i class="fa fa-caret-down" ng-show="sort.jobsCurrentList =='client'"></i><i class="fa fa-caret-up" ng-show="sort.jobsCurrentList =='d-client'"></i></th>
        <th scope="col" ng-click="orderList('jobsCurrentList', 'from')">From <i class="fa fa-caret-down" ng-show="sort.jobsCurrentList =='from'"></i><i class="fa fa-caret-up" ng-show="sort.jobsCurrentList =='d-from'"></i></th>
        <th scope="col" ng-click="orderList('jobsCurrentList', 'to')">To <i class="fa fa-caret-down" ng-show="sort.jobsCurrentList =='to'"></i><i class="fa fa-caret-up" ng-show="sort.jobsCurrentList =='d-to'"></i></th>
		<th scope="col" ng-click="orderList('jobsCurrentList','to')">Street <i class="fa fa-caret-down" ng-show="sort.jobsCurrentList == 'to'"></i><i class="fa fa-caret-up" ng-show="sort.jobsCurrentList == 'd-to'"></i></th>
        <th scope="col" ng-click="orderList('jobsCurrentList', 'vehicle')">V <i class="fa fa-caret-down" ng-show="sort.jobsCurrentList =='vehicle'"></i><i class="fa fa-caret-up" ng-show="sort.jobsCurrentList =='d-vehicle'"></i></th>
		<th scope="col" ng-click="orderList('jobsCurrentList', 'runOrder')">RO <i class="fa fa-caret-down" ng-show="sort.jobsCurrentList =='runOrder'"></i><i class="fa fa-caret-up" ng-show="sort.jobsCurrentList =='d-runOrder'"></i></th>
        <th scope="col" ng-click="orderList('jobsCurrentList', 'lp')">LP <i class="fa fa-caret-down" ng-show="sort.jobsCurrentList =='lp'"></i><i class="fa fa-caret-up" ng-show="sort.jobsCurrentList =='d-lp'"></i></th>
        <th scope="col" ng-click="orderList('jobsCurrentList', 'ld')">LD <i class="fa fa-caret-down" ng-show="sort.jobsCurrentList =='ld'"></i><i class="fa fa-caret-up" ng-show="sort.jobsCurrentList =='d-ld'"></i></th>
        </tr>
        </thead>
    </table>


</div>

<table class="table table-striped table-responsive table-rows" id="currentWork" data-group="currentWork">
    <thead class="thead-dark no select">

    </tr>
    </thead>
    <tbody>
    <tr class="droppable-row draggable-row clickable-row noselect" ng-repeat="job in jobsCurrentList | filter: box.searchBox" context-menu="setCurrentWorkMenu" ng-click="selectJobDetail(job);" data-courier="{{job.courier}}" data-jobid="{{job.id}}" data-jobNo="{{job.jobNo}}">
            <td class="status" ng-class="job.status">{{job.status}}</td>
			<td>{{job.remain}}</td>
            <td>{{job.speed}}</td>
            <td>{{job.notify}}</td>
            <td>{{job.jobNo}}</td>
            <td>{{job.client}}</td>
            <td>{{job.from}} <i ng-if="!job.pickUpLongitude" class="fa fa-exclamation"></i></td>
            <td>{{job.to}} <i ng-if="!job.deliveryLongitude" class="fa fa-exclamation"></i></td>
			<td><div style="width:200px; white-space:nowrap; overflow-x:hidden;" title="{{job.toAddress}}">{{job.toAddress}}</div></td>
            <td>{{job.vehicle.label}}</td>
			<td>{{job.runOrder}}</td>
            <td>{{job.lp}}</td>
            <td>{{job.ld}}</td>
            <td class="selectjob" ng-click="selectForDispatch(job); $event.stopPropagation();" title="placeholder selector" style="display:none"></td>
        </tr>
        <tr>
            <td><div></div></td>
            <td><div></div></td>
            <td><div style="width:12px;"></div></td>
            <td><div></div></td>
            <td><div></div></td>
            <td><div></div></td>
            <td><div></div></td>
            <td><div></div></td>
			<td><div></div></td>
            <td><div></div></td>
			<td><div></div></td>
            <td><div style="width:12px;"></div></td>
            <td><div style="width:12px;"></div></td>
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