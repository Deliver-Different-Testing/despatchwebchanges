 <div class="table-headings">
    <table>
        <thead class="thead-dark no select">
            <th scope="col" ng-click="orderList('supports', 'time')">Time <i class="fa fa-caret-down" ng-show="sort.supports == 'time'"></i><i class="fa fa-caret-up" ng-show="sort.supports == 'd-time'"></i></th>
            <th scope="col" ng-click="orderList('supports', 'courier')"># <i class="fa fa-caret-down" ng-show="sort.supports == 'courier'"></i><i class="fa fa-caret-up" ng-show="sort.supports == 'd-courier'"></i></th>
            <th scope="col" ng-click="orderList('supports', 'staff')">Staff <i class="fa fa-caret-down" ng-show="sort.supports == 'staff'"></i><i class="fa fa-caret-up" ng-show="sort.supports == 'd-staff'"></i></th>
            <th scope="col" ng-click="orderList('supports', 'jobNum')">Job # <i class="fa fa-caret-down" ng-show="sort.supports == 'jobNum'"></i><i class="fa fa-caret-up" ng-show="sort.supports == 'd-jobNum'"></i></th>
            <th scope="col" ng-click="orderList('supports', 'event')">Event<i class="fa fa-caret-down" ng-show="sort.supports == 'event'"></i><i class="fa fa-caret-up" ng-show="sort.supports == 'd-event'"></i></th>
            <th scope="col" ng-click="orderList('supports', 'notes')">Notes<i class="fa fa-caret-down" ng-show="sort.supports == 'notes'"></i><i class="fa fa-caret-up" ng-show="sort.supports == 'd-notes'"></i></th>
            <th scope="col" ng-click="orderList('supports', 'remain')">Remain<i class="fa fa-caret-down" ng-show="sort.supports == 'remain'"></i><i class="fa fa-caret-up" ng-show="sort.supports == 'd-remain'"></i></th>
            <th scope="col" ng-click="orderList('supports', 'lockedBy')">Locked by<i class="fa fa-caret-down" ng-show="sort.supports == 'lockedBy'"></i><i class="fa fa-caret-up" ng-show="sort.supports == 'd-lockedBy'"></i></th>
        </thead>
    </table>
</div>

<table class="table table-striped table-rows table-responsive" id="supports" data-group="supports">
    <tbody>
    <tr class="clickable-row" ng-class="getSupportColorClass(support)" ng-repeat="support in supports | filter: box.searchBox" ng-click="selectSupportJobDetail(support)"  data-id="{{support.eventId}}" context-menu="supportMenu">
        <td>{{support.timeStamp | date : "HH:mm"}}</td>
        <td width="30">{{support.courier}}</td>
        <td width="60">{{support.staff}}</td>
        <td>{{support.jobNumber}}</td>
        <td>{{support.description}}</td>
        <td>{{support.notes}}</td>
        <td>{{support.remainTime}}</td>
        <td width="60" style="cursor:pointer;" ng-click="lockSupport(support)">{{support.lockedBy}}</td>
    </tr>
    <tr>
        <td><div style="width:30px;"></div></td>
        <td><div style="width:30px;"></div></td>
        <td><div style="width:40px;"></div></td>
        <td><div style="width:40px;"></div></td>
        <td><div style="width:60px;"></div></td>
        <td><div style="width:40px;"></div></td>
        <td><div style="width:30px;"></div></td>
        <td><div style="width:60px;"></div></td>
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