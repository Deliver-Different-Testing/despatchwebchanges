

    <div class="table-headings">
        <table>
            <thead class="thead-dark no select">
            <tr>
                <th scope="col" ng-click="orderList('jobList','Status')">S <i class="fa fa-caret-down" ng-show="sort.jobList == 'Status'"></i><i class="fa fa-caret-up" ng-show="sort.jobList == 'd-Status'"></i></th>
                <th scope="col" ng-click="orderList('jobList', 'Speed')">Speed <i class="fa fa-caret-down" ng-show="sort.jobList == 'Speed'"></i><i class="fa fa-caret-up" ng-show="sort.jobList == 'd-Speed'"></i></th>
                <th scope="col" ng-click="orderList('jobList','Notify')">N <i class="fa fa-caret-down" ng-show="sort.jobList == 'Notify'"></i><i class="fa fa-caret-up" ng-show="sort.jobList == 'd-Notify'"></i></th>
                <th scope="col" ng-click="orderList('jobList','JobNo')">Job <i class="fa fa-caret-down" ng-show="sort.jobList == 'JobNo'"></i><i class="fa fa-caret-up" ng-show="sort.jobList == 'd-JobNo'"></i></th>
                <th scope="col" ng-click="orderList('jobList','Client')">Client <i class="fa fa-caret-down" ng-show="sort.jobList == 'Client'"></i><i class="fa fa-caret-up" ng-show="sort.jobList == 'd-Client'"></i></th>
                <th scope="col" ng-click="orderList('jobList','From')">From <i class="fa fa-caret-down" ng-show="sort.jobList == 'From'"></i><i class="fa fa-caret-up" ng-show="sort.jobList == 'd-From'"></i></th>
                <th scope="col" ng-click="orderList('jobList','To')">To <i class="fa fa-caret-down" ng-show="sort.jobList == 'To'"></i><i class="fa fa-caret-up" ng-show="sort.jobList == 'd-To'"></i></th>
                <th scope="col" ng-click="orderList('jobList','Vehicle')">V <i class="fa fa-caret-down" ng-show="sort.jobList == 'Vehicle'"></i><i class="fa fa-caret-up" ng-show="sort.jobList == 'd-Vehicle'"></i></th>
                <th scope="col" ng-click="orderList('jobList','Remain')">R <i class="fa fa-caret-down" ng-show="sort.jobList == 'Remain'"></i><i class="fa fa-caret-up" ng-show="sort.jobList == 'd-Remain'"></i></th>
                <th scope="col" ng-click="orderList('jobList','LP')">LP <i class="fa fa-caret-down" ng-show="sort.jobList == 'LP'"></i><i class="fa fa-caret-up" ng-show="sort.jobList == 'd-LP'"></i></th>
                <th scope="col" ng-click="orderList('jobList','LD')">LD <i class="fa fa-caret-down" ng-show="sort.jobList == 'LD'"></i><i class="fa fa-caret-up" ng-show="sort.jobList == 'd-LD'"></i></th>
                <th></th>
                <th></th>
            </tr>
            </thead>
        </table>

    </div>


    <table class="table table-striped table-responsive table-rows" id="jobList" data-group="jobsGroup">
        <tbody>
        <tr class="clickable-row draggable-row noselect" ng-repeat="job in jobList | filter: box.searchBox" context-menu="jobsMenu" data-jobid="{{job.ID}}" data-jobno="{{job.JobNo}}" data-index="{{$index}}" ng-mouseup="selectJob(job, true)">
            <td class="status" ng-class="job.Status">{{job.Status}}</td>
            <td>{{job.Speed}}</td>
            <td>{{job.Notify}}</td>
            <td>{{job.JobNo}}</td>
            <td>{{job.Client}}</td>
            <td>{{job.From}} <i ng-if="!job.PickUpLongitude" class="fa fa-exclamation"></i></td>
            <td>{{job.To}} <i ng-if="!job.DeliveryLongitude" class="fa fa-exclamation"></i></td>
            <td>{{job.Vehicle.label}}</td>
            <td>{{job.Remain}}</td>
            <td>{{job.LP}}</td>
            <td>{{job.LD}}</td>
            <td><input type="text" class="dispatchField" ng-model="job.courierNumber" ng-keydown="$event.keyCode === 13 && dispatchJobs(job.courierNumber)" placeholder="D" /></td>
            <td><input type="text" class="lateCallField" ng-model="job.latePickup" ng-keydown="$event.keyCode === 13 && lateCall(job.latePickup)"  placeholder="LP" /></td>
            <td><input type="text" class="lateCallField" ng-model="job.lateDelivery" ng-keydown="$event.keyCode === 13 && lateCall(job.lateDelivery)"  placeholder="LD" /></td>
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