<div class="table-headings">
    <table>
        <thead class="thead-dark no select">
            <tr>
                <th scope="col" ng-click="orderList('lateCalls', 'jobNum')">Job # <i class="fa fa-caret-down" ng-show="sort.lateCalls == 'jobNum'"></i><i class="fa fa-caret-up" ng-show="sort.lateCalls == 'd-jobNum'"></i></th>
                <th scope="col" ng-click="orderList('lateCalls', 'puOrDel')">PU or DEL <i class="fa fa-caret-down" ng-show="sort.lateCalls == 'puOrDel'"></i><i class="fa fa-caret-up" ng-show="sort.lateCalls == 'd-puOrDel'"></i></th>
                <th scope="col" ng-click="orderList('lateCalls', 'jobType')">Job Type <i class="fa fa-caret-down" ng-show="sort.lateCalls == 'jobType'"></i><i class="fa fa-caret-up" ng-show="sort.lateCalls == 'd-jobType'"></i></th>
                <th scope="col" ng-click="orderList('lateCalls', 'lateMin')">Late<i class="fa fa-caret-down" ng-show="sort.lateCalls == 'lateMin'"></i><i class="fa fa-caret-up" ng-show="sort.lateCalls == 'd-lateMin'"></i></th>
                <th scope="col" ng-click="orderList('lateCalls', 'eta')">ETA<i class="fa fa-caret-down" ng-show="sort.lateCalls == 'eta'"></i><i class="fa fa-caret-up" ng-show="sort.lateCalls == 'd-eta'"></i></th>
                <th scope="col" ng-click="orderList('lateCalls', 'lockedBy')">Locked<i class="fa fa-caret-down" ng-show="sort.lateCalls == 'lockedBy'"></i><i class="fa fa-caret-up" ng-show="sort.lateCalls == 'd-lockedBy'"></i></th>
            </tr>
        </thead>
    </table>
</div>

<table class="table table-striped table-rows table-responsive" id="lateCalls" data-group="lateCalls">
    <thead class="thead-dark no select">

    </thead>
    <tbody>
    <tr class="clickable-row" ng-repeat="lateCall in lateCalls | filter: box.searchBox" ng-click="" context-menu="lateCallsMenu">
        <td width="55">{{lateCall.jobNum}}</td>
        <td width="55">{{lateCall.puOrDel}}</td>
        <td>{{lateCall.jobType}}</td>
        <td>{{lateCall.lateMin}}</td>
        <td>{{lateCall.eta}}</td>
        <td>{{lateCall.lockedBy}}</td>
    </tr>
    <tr>
        <td><div style="width:50px;"></div></td>
        <td><div style="width:50px;"></div></td>
        <td><div style="width:50px;"></div></td>
        <td></td>
        <td></td>
        <td></td>
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