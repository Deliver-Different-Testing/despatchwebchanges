

    <div class="table-headings">
        <table>
            <thead class="thead-dark no select">
            <tr>
                <th scope="col" ng-click="orderList('jobList','status')">S <i class="fa fa-caret-down" ng-show="sort.jobList == 'status'"></i><i class="fa fa-caret-up" ng-show="sort.jobList == 'd-status'"></i></th>
                <th scope="col" ng-click="orderList('jobList', 'speed')">Speed <i class="fa fa-caret-down" ng-show="sort.jobList == 'speed'"></i><i class="fa fa-caret-up" ng-show="sort.jobList == 'd-speed'"></i></th>
                <th scope="col" ng-click="orderList('jobList','notify')">N <i class="fa fa-caret-down" ng-show="sort.jobList == 'notify'"></i><i class="fa fa-caret-up" ng-show="sort.jobList == 'd-notify'"></i></th>
                <th scope="col" ng-click="orderList('jobList','jobNo')">Job <i class="fa fa-caret-down" ng-show="sort.jobList == 'jobNo'"></i><i class="fa fa-caret-up" ng-show="sort.jobList == 'd-jobNo'"></i></th>
                <th scope="col" ng-click="orderList('jobList','client')">Client <i class="fa fa-caret-down" ng-show="sort.jobList == 'client'"></i><i class="fa fa-caret-up" ng-show="sort.jobList == 'd-client'"></i></th>
                <th scope="col" ng-click="orderList('jobList','from')">From <i class="fa fa-caret-down" ng-show="sort.jobList == 'from'"></i><i class="fa fa-caret-up" ng-show="sort.jobList == 'd-from'"></i></th>
                <th scope="col" ng-click="orderList('jobList','to')">To <i class="fa fa-caret-down" ng-show="sort.jobList == 'to'"></i><i class="fa fa-caret-up" ng-show="sort.jobList == 'd-to'"></i></th>
				<th scope="col" ng-click="orderList('jobList','to')">Street <i class="fa fa-caret-down" ng-show="sort.jobList == 'to'"></i><i class="fa fa-caret-up" ng-show="sort.jobList == 'd-to'"></i></th>
                <th scope="col" ng-click="orderList('jobList','vehicle')">V <i class="fa fa-caret-down" ng-show="sort.jobList == 'vehicle'"></i><i class="fa fa-caret-up" ng-show="sort.jobList == 'd-vehicle'"></i></th>
                <th scope="col" ng-click="orderList('jobList','remain')">R <i class="fa fa-caret-down" ng-show="sort.jobList == 'remain'"></i><i class="fa fa-caret-up" ng-show="sort.jobList == 'd-remain'"></i></th>
                <th scope="col" ng-click="orderList('jobList','lp')">LP <i class="fa fa-caret-down" ng-show="sort.jobList == 'lp'"></i><i class="fa fa-caret-up" ng-show="sort.jobList == 'd-lp'"></i></th>
                <th scope="col" ng-click="orderList('jobList','ld')">LD <i class="fa fa-caret-down" ng-show="sort.jobList == 'ld'"></i><i class="fa fa-caret-up" ng-show="sort.jobList == 'd-ld'"></i></th>
                <th></th>
                <th></th>
            </tr>
            </thead>
        </table>

    </div>


    <table class="table table-striped table-responsive table-rows" id="jobList" data-group="jobsGroup">
        <tbody>
        <tr class="clickable-row draggable-row noselect" ng-repeat="job in jobList | filter: box.searchBox" context-menu="setJobsMenu" data-courier="{{job.courier}}" data-jobid="{{job.id}}" data-jobno="{{job.jobNo}}" data-allowDispatch="{{job.allowDispatch}}" data-index="{{$index}}" ng-mouseup="selectJob(job, true)">
            <td class="status" ng-class="job.status">{{job.status}}</td>
            <td>{{job.speed}}</td>
            <td>{{job.notify}}</td>
            <td>{{job.jobNo}}</td>
            <td>{{job.client}}</td>
            <td>{{job.from}} <i ng-if="!job.pickUpLongitude" class="fa fa-exclamation"></i></td>
            <td>{{job.to}} <i ng-if="!job.deliveryLongitude" class="fa fa-exclamation"></i></td>
			<td>{{job.from}}&nbsp;{{job.toAddress}}&nbsp;</td>
            <td>{{job.vehicle.label}}</td>
            <td>{{job.remain}}</td>
            <td>{{job.lp}}</td>
            <td>{{job.ld}}</td>
            <td><input type="text" class="dispatchField" ng-readonly="job.courierData.courierID !== null" ng-model="job.courier" ng-keydown="$event.keyCode === 13 && dispatchJobs(job.courier)" placeholder="D" /></td>
            <td><input type="text" class="lateCallField" ng-model="job.lp" ng-keydown="$event.keyCode === 13 && lateCall(job.lp)"  placeholder="LP" /></td>
            <td><input type="text" class="lateCallField" ng-model="job.ld" ng-keydown="$event.keyCode === 13 && lateCall(job.ld)"  placeholder="LD" /></td>
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
            <td><div style="width:12px;"></div></td>
            <td><div style="width:12px;"></div></td>
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