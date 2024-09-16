
<div class="table-headings">
    <table>
        <thead class="thead-dark no select">
        <tr>
            <th ng-click="orderList('couriersThrough', 'courier')" scope="col">Courier <i class="fa fa-caret-down"
                                                                                          ng-if="sort.couriersThrough == 'courier'"></i><i
                    class="fa fa-caret-up" ng-if="sort.couriersThrough == 'd-courier'"></i></th>
            <th ng-click="orderList('couriersThrough', 'location')" scope="col">Location <i class="fa fa-caret-down"
                                                                                            ng-if="sort.couriersThrough == 'location'"></i><i
                    class="fa fa-caret-up" ng-if="sort.couriersThrough == 'd-location'"></i></th>
            <th ng-click="orderList('couriersThrough', 'heading')" scope="col">Heading To <i class="fa fa-caret-down"
                                                                                             ng-if="sort.couriersThrough == 'heading'"></i><i
                    class="fa fa-caret-up" ng-if="sort.couriersThrough == 'd-heading'"></i></th>
            <th ng-click="orderList('couriersThrough', 'lrm')" scope="col">LRM <i class="fa fa-caret-down"
                                                                                  ng-if="sort.couriersThrough == 'lrm'"></i><i
                    class="fa fa-caret-up" ng-if="sort.couriersThrough == 'd-lrm'"></i></th>
            <th ng-click="orderList('couriersThrough', 'eta2lrm')" scope="col">ETA<i class="fa fa-caret-down"
                                                                                     ng-if="sort.couriersThrough == 'eta2lrm'"></i><i
                    class="fa fa-caret-up" ng-if="sort.couriersThrough == 'd-eta2lrm'"></i></th>
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
