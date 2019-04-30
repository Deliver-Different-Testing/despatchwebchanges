<div ng-if="jobsCurrentList">

<div class="table-headings">
    <table>
        <thead class="thead-dark no select">
        <tr>
        <th scope="col" ng-click="orderList('jobsCurrentList', 'Status')">S <i class="fa fa-caret-down" ng-show="sort.jobsCurrentList =='Status'"></i><i class="fa fa-caret-up" ng-show="sort.jobsCurrentList =='d-Status'"></i></th>
        <th scope="col" ng-click="orderList('jobsCurrentList', 'Speed')">Speed <i class="fa fa-caret-down" ng-show="sort.jobsCurrentList =='Speed'"></i><i class="fa fa-caret-up" ng-show="sort.jobsCurrentList =='d-Speed'"></i></th>
        <th scope="col" ng-click="orderList('jobsCurrentList', 'Notify')">N <i class="fa fa-caret-down" ng-show="sort.jobsCurrentList =='Notify'"></i><i class="fa fa-caret-up" ng-show="sort.jobsCurrentList =='d-Notify'"></i></th>
        <th scope="col" ng-click="orderList('jobsCurrentList', 'JobNo')">Job <i class="fa fa-caret-down" ng-show="sort.jobsCurrentList =='JobNo'"></i><i class="fa fa-caret-up" ng-show="sort.jobsCurrentList =='d-JobNo'"></i></th>
        <th scope="col" ng-click="orderList('jobsCurrentList', 'Client')">Client <i class="fa fa-caret-down" ng-show="sort.jobsCurrentList =='Client'"></i><i class="fa fa-caret-up" ng-show="sort.jobsCurrentList =='d-Client'"></i></th>
        <th scope="col" ng-click="orderList('jobsCurrentList', 'From')">From <i class="fa fa-caret-down" ng-show="sort.jobsCurrentList =='From'"></i><i class="fa fa-caret-up" ng-show="sort.jobsCurrentList =='d-From'"></i></th>
        <th scope="col" ng-click="orderList('jobsCurrentList', 'To')">To <i class="fa fa-caret-down" ng-show="sort.jobsCurrentList =='To'"></i><i class="fa fa-caret-up" ng-show="sort.jobsCurrentList =='d-To'"></i></th>
        <th scope="col" ng-click="orderList('jobsCurrentList', 'Vehicle')">V <i class="fa fa-caret-down" ng-show="sort.jobsCurrentList =='Vehicle'"></i><i class="fa fa-caret-up" ng-show="sort.jobsCurrentList =='d-Vehicle'"></i></th>
        <th scope="col" ng-click="orderList('jobsCurrentList', 'Remain')">R <i class="fa fa-caret-down" ng-show="sort.jobsCurrentList =='Remain'"></i><i class="fa fa-caret-up" ng-show="sort.jobsCurrentList =='d-Remain'"></i></th>
        <th scope="col" ng-click="orderList('jobsCurrentList', 'LP')">LP <i class="fa fa-caret-down" ng-show="sort.jobsCurrentList =='LP'"></i><i class="fa fa-caret-up" ng-show="sort.jobsCurrentList =='d-LP'"></i></th>
        <th scope="col" ng-click="orderList('jobsCurrentList', 'LD')">LD <i class="fa fa-caret-down" ng-show="sort.jobsCurrentList =='LD'"></i><i class="fa fa-caret-up" ng-show="sort.jobsCurrentList =='d-LD'"></i></th>
        </tr>
        </thead>
    </table>


</div>

<table class="table table-striped table-responsive table-rows" id="currentWork" data-group="currentWork">
    <thead class="thead-dark no select">

    </tr>
    </thead>
    <tbody>
    <tr class="clickable-row noselect" ng-repeat="job in jobsCurrentList | filter: box.searchBox" ng-click="selectJob(job)" data-jobid="{{job.ID}}" data-jobNo="{{job.JobNo}}">
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