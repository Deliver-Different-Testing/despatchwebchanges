<div ng-if="potentialCouriers">

<div class="table-headings">
    <table>
        <thead class="thead-dark no select">
        <tr>
        <th scope="col" ng-click="orderList('potentialCouriers', 'courier')">Courier <i class="fa fa-caret-down" ng-show="sort.potentialCouriers =='courier'"></i><i class="fa fa-caret-up" ng-show="sort.potentialCouriers =='d-courier'"></i></th>
        <th scope="col" ng-click="orderList('potentialCouriers', 'rule')">Rule# <i class="fa fa-caret-down" ng-show="sort.potentialCouriers =='Rule'"></i><i class="fa fa-caret-up" ng-show="sort.potentialCouriers =='d-rule'"></i></th>
        <th scope="col" ng-click="orderList('potentialCouriers', 'reason')">Reason <i class="fa fa-caret-down" ng-show="sort.potentialCouriers =='reason'"></i><i class="fa fa-caret-up" ng-show="sort.potentialCouriers =='d-reason'"></i></th>
        <!--<th scope="col" ng-click="orderList('potentialCouriers', 'del')">DEL <i class="fa fa-caret-down" ng-show="sort.potentialCouriers =='del'"></i><i class="fa fa-caret-up" ng-show="sort.potentialCouriers =='d-del'"></i></th>
        <th scope="col" ng-click="orderList('potentialCouriers', 'lrm')">LRM <i class="fa fa-caret-down" ng-show="sort.potentialCouriers =='lrm'"></i><i class="fa fa-caret-up" ng-show="sort.potentialCouriers =='d-lrm'"></i></th>
        <th scope="col" ng-click="orderList('potentialCouriers', 'eta2lrm')">ETA<i class="fa fa-caret-down" ng-show="sort.potentialCouriers =='eta2lrm'"></i><i class="fa fa-caret-up" ng-show="sort.potentialCouriers =='d-eta2lrm'"></i></th>-->
        </tr>
        </thead>
    </table>


</div>

<table class="table table-striped table-responsive table-rows" id="potentialCouriers" data-group="couriers">
    <tbody>
    <tr class="clickable-row droppable-row" ng-repeat="courier in potentialCouriers" track by $index ng-click="selectPotentialCourier(courier)" context-menu="courierMenu" data-courier="{{courier.courier}}">
        <td>{{courier.code}}&nbsp;{{courier.firstName}}</td>
        <td>{{courier.ruleNumber}}</td>
        <td>{{courier.reason}}</td>

    </tr>
    <tr>
        <td><div style="width:50px;"></div></td>
        <td><div style="width:50px;"></div></td>
        <td></td>
        
    </tr>
    </tbody>
</table>

</div>

<div class="no-data" ng-if="!potentialCouriers">
    <div class="text">Please select a job</div>
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