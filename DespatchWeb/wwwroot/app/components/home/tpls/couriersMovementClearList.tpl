<div class="table-headings">
    <table>
        <thead class="thead-dark no select">
        <tr>
        <th scope="col" ng-click="orderList('couriersClear', 'courier')">Courier <i class="fa fa-caret-down" ng-show="sort.couriersClear == 'courier'"></i><i class="fa fa-caret-up" ng-show="sort.couriersClear == 'd-courier'"></i></th>
        <th scope="col" ng-click="orderList('couriersClear', 'location')">Location <i class="fa fa-caret-down" ng-show="sort.couriersClear == 'location'"></i><i class="fa fa-caret-up" ng-show="sort.couriersClear == 'd-location'"></i></th>
        </tr>
        </thead>
    </table>
</div>

<table class="table table-striped table-responsive table-rows" id="couriersClear" data-group="couriers">
    <tbody>
    <tr class="clickable-row droppable-row" ng-repeat="courier in couriersClear | filter: box.searchBox" ng-click="selectCourier(courier)" context-menu="couriersClearMenu">
        <td>{{courier.courier}}</td>
        <td>{{courier.location}}</td>
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