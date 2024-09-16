<div ng-if="jobGroups">

<div class="table-headings">
    <table>
        <thead class="thead-dark no select">
        <tr>
            <th scope="col" ng-click="orderList('jobGroups','Status')">S <i class="fa fa-caret-down" ng-show="sort.jobGroups == 'Status'"></i><i class="fa fa-caret-up" ng-show="sort.jobGroups == 'd-Status'"></i></th>
            <th scope="col" ng-click="orderList('jobGroups', 'Speed')">Speed <i class="fa fa-caret-down" ng-show="sort.jobGroups == 'Speed'"></i><i class="fa fa-caret-up" ng-show="sort.jobGroups == 'd-Speed'"></i></th>
            <th scope="col" ng-click="orderList('jobGroups','Notify')">N <i class="fa fa-caret-down" ng-show="sort.jobGroups == 'Notify'"></i><i class="fa fa-caret-up" ng-show="sort.jobGroups == 'd-Notify'"></i></th>
            <th scope="col" ng-click="orderList('jobGroups','JobNo')">Job <i class="fa fa-caret-down" ng-show="sort.jobGroups == 'JobNo'"></i><i class="fa fa-caret-up" ng-show="sort.jobGroups == 'd-JobNo'"></i></th>
            <th scope="col" ng-click="orderList('jobGroups','Client')">Client <i class="fa fa-caret-down" ng-show="sort.jobGroups == 'Client'"></i><i class="fa fa-caret-up" ng-show="sort.jobGroups == 'd-Client'"></i></th>
            <th scope="col" ng-click="orderList('jobGroups','From')">From <i class="fa fa-caret-down" ng-show="sort.jobGroups == 'From'"></i><i class="fa fa-caret-up" ng-show="sort.jobGroups == 'd-From'"></i></th>
            <th scope="col" ng-click="orderList('jobGroups','To')">To <i class="fa fa-caret-down" ng-show="sort.jobGroups == 'To'"></i><i class="fa fa-caret-up" ng-show="sort.jobGroups == 'd-To'"></i></th>
            <th scope="col" ng-click="orderList('jobGroups','Vehicle')">V <i class="fa fa-caret-down" ng-show="sort.jobGroups == 'Vehicle'"></i><i class="fa fa-caret-up" ng-show="sort.jobGroups == 'd-Vehicle'"></i></th>
            <th scope="col" ng-click="orderList('jobGroups','Remain')">R <i class="fa fa-caret-down" ng-show="sort.jobGroups == 'Remain'"></i><i class="fa fa-caret-up" ng-show="sort.jobGroups == 'd-Remain'"></i></th>
            <th scope="col" ng-click="orderList('jobGroups','LP')">LP <i class="fa fa-caret-down" ng-show="sort.jobGroups == 'LP'"></i><i class="fa fa-caret-up" ng-show="sort.jobGroups == 'd-LP'"></i></th>
            <th scope="col" ng-click="orderList('jobGroups','LD')">LD <i class="fa fa-caret-down" ng-show="sort.jobGroups == 'LD'"></i><i class="fa fa-caret-up" ng-show="sort.jobGroups == 'd-LD'"></i></th>
        </tr>
        </thead>
    </table>

</div>

<table class="table table-striped table-responsive table-rows" id="jobGroups" data-group="jobsGrouped">
    <tbody>
        <tr class="clickable-row draggable-row noselect" ng-repeat="job in jobGroups | filter: box.searchBox" ng-click="selectJob(job)" context-menu="setJobsMenu" data-jobid="{{job.ID}}" data-jobno="{{job.JobNo}}" data-index="{{$index}}">
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

<div class="no-data" ng-if="!jobGroups">
    <div class="text">Please select a job</div>
</div>

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
