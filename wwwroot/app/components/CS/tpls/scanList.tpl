<div class="droppable-box" style="min-height:500px">

    <div class="table-b-headings builder">
        <table>
            <thead class="thead-dark no select">
            <tr>
                <th ng-repeat="heading in boxes.scanList.headings" scope="col" ng-click="orderList(boxes.scanList.model,heading.name)">{{heading.label}} <i class="fa fa-caret-down" ng-show="sort[boxes.scanList.model] == heading.name"></i><i class="fa fa-caret-up" ng-show="sort.scanList == 'd-'+heading.name"></i></th>
            </tr>
            </thead>
        </table>

    </div>

    <table class="table table-striped table-responsive table-rows builder" id="scanList" data-group="scanList">
        <tbody>


        <tr class="clickable-row noselect  droppable-item" id="scan-{{scan.bulkScanID}}"  ng-repeat="scan in scanList  track by $index" context-menu="scanListMenu" data-scanid="{{scan.bulkScanID}}"  data-index="{{$index}}">
            <td style="width:30%">{{scan.scanDateTime  | date : "dd/MM/yyyy h:mm:a"}}</td>
            <td style="width:20%">{{scan.scanDetail}}</td>
            <td>{{scan.courier}}</td>

        </tr>



        <tr style="opacity:0">
            <td><div></div></td>
            <td><div></div></td>
            <td><div></div></td>


        </tr>
        </tbody>
    </table>




</div>
<div class="loading">
    <div class="text">
        <md-progress-circular md-mode="indeterminate"></md-progress-circular>
        <span class="sr-only">Loading...</span>
    </div>
</div>



<script>

    angular.element(".box-content").on("scroll", function () {

        var newTop2 = angular.element(this).scrollTop();
        angular.element(this).find(".box-calculator").css({"top": newTop2});

    });

</script>
