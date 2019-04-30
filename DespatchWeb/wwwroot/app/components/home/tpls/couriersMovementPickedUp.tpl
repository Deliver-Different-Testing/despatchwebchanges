<div class="table-headings">
    <table>
        <thead class="thead-dark no select">
        <tr>
        <th scope="col" ng-click="orderList('couriersPicked', 'courier')" style="min-width:50px;">Courier <i class="fa fa-caret-down" ng-show="sort.couriersPicked == 'courier'"></i><i class="fa fa-caret-up" ng-show="sort.couriersPicked == 'd-courier'"></i></th>
        <th scope="col" ng-click="orderList('couriersPicked', 'location')">Location <i class="fa fa-caret-down" ng-show="sort.couriersPicked == 'location'"></i><i class="fa fa-caret-up" ng-show="sort.couriersPicked == 'd-location'"></i></th>
        <th scope="col" ng-click="orderList('couriersPicked', 'heading')">Heading To <i class="fa fa-caret-down" ng-show="sort.couriersPicked == 'heading'"></i><i class="fa fa-caret-up" ng-show="sort.couriersPicked == 'd-heading'"></i></th>
        <th scope="col" ng-click="orderList('couriersPicked', 'lrm')">LRM <i class="fa fa-caret-down" ng-show="sort.couriersPicked == 'lrm'"></i><i class="fa fa-caret-up" ng-show="sort.couriersPicked == 'd-lrm'"></i></th>
        <th scope="col" ng-click="orderList('couriersPicked', 'eta2lrm')">ETA<i class="fa fa-caret-down" ng-show="sort.couriersPicked == 'eta2lrm'"></i><i class="fa fa-caret-up" ng-show="sort.couriersPicked == 'd-eta2lrm'"></i></th>
        </tr>
        </thead>
    </table>
</div>

<table class="table table-striped table-responsive table-rows" id="couriersPicked" data-group="couriers">
    <tbody>
    <tr class="clickable-row droppable-row" ng-repeat="courier in couriersPicked | filter: box.searchBox" ng-click="selectCourier(courier)" context-menu="couriersPickedMenu">
        <td>{{courier.courier}}</td>
        <td>{{courier.location}}</td>
        <td>{{courier.heading}}</td>
        <td>{{courier.lrm}}</td>
        <td>{{courier.eta2lrm}}</td>
    </tr>
    <tr>
        <td><div style="width:50px;"></div></td>
        <td><div style="width:50px;"></div></td>
        <td><div style="width:50px;"></div></td>
        <td><div style="width:30px;"></div></td>
        <td><div style="width:30px;"></div></td>
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