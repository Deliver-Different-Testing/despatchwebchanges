
<div class="table-headings">
    <table>
        <thead class="thead-dark no select">
        <tr>
        <th scope="col" ng-click="orderList('couriersThrough', 'courier')">Courier <i class="fa fa-caret-down" ng-show="sort.couriersThrough == 'courier'"></i><i class="fa fa-caret-up" ng-show="sort.couriersThrough == 'd-courier'"></i></th>
        <th scope="col" ng-click="orderList('couriersThrough', 'location')">Location <i class="fa fa-caret-down" ng-show="sort.couriersThrough == 'location'"></i><i class="fa fa-caret-up" ng-show="sort.couriersThrough == 'd-location'"></i></th>
        <th scope="col" ng-click="orderList('couriersThrough', 'heading')">Heading To <i class="fa fa-caret-down" ng-show="sort.couriersThrough == 'heading'"></i><i class="fa fa-caret-up" ng-show="sort.couriersThrough == 'd-heading'"></i></th>
        <th scope="col" ng-click="orderList('couriersThrough', 'lrm')">LRM <i class="fa fa-caret-down" ng-show="sort.couriersThrough == 'lrm'"></i><i class="fa fa-caret-up" ng-show="sort.couriersThrough == 'd-lrm'"></i></th>
        <th scope="col" ng-click="orderList('couriersThrough', 'eta2lrm')">ETA<i class="fa fa-caret-down" ng-show="sort.couriersThrough == 'eta2lrm'"></i><i class="fa fa-caret-up" ng-show="sort.couriersThrough == 'd-eta2lrm'"></i></th>
        </tr>
        </thead>
    </table>
</div>

<table class="table table-striped table-responsive table-rows" id="couriersThrough" data-group="couriers">
    <tbody>
    <tr class="clickable-row droppable-row" ng-repeat="courier in couriersThrough | filter: box.searchBox" ng-click="selectCourier(courier)" context-menu="couriersThroughMenu">
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