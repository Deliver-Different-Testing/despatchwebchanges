<div class="table-headings">
    <table>
        <thead class="thead-dark no select">
        <tr>
        <th scope="col">Area</th>
        <th scope="col"># </th>
        <th scope="col">Clear</th>
        <th scope="col">In Area</th>
        </thead>
    </table>
</div>

<table class="table table-striped table-responsive table-rows" id="areaList" data-group="areaList">
    <tbody>
    <tr class="clickable-row" ng-repeat="area in areaList | filter: box.searchBox" ng-click="" ng-class="{late: area.late}">
        <td>{{area.area}}</td>
        <td>{{area.waiting}}</td>
        <td>
            <a href="#" ng-repeat="clear in area.clear" ng-click="selectCourier(clear)" class="btn btn-default btn-sm" style="margin-right: 4px;padding: 3px;font-size: 8px;paddding-bottom: 1px;">{{clear.courierNo}}</a>
        </td>
        <td>
            <a href="#" ng-repeat="inArea in area.inArea" ng-click="selectCourier(inArea)" class="btn btn-default btn-sm" style="margin-right: 4px;padding: 3px;font-size: 8px;paddding-bottom: 1px;">{{inArea.courierNo}}</a>
        </td>
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