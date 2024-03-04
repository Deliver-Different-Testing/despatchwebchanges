
<div class="droppable-box" style="min-height:500px">

   <div class="table-headings">
    <table>
        <thead class="thead-dark no select">
        <tr>
        <th scope="col" ng-click="orderList('bulkJobList', 'booked')">Booked <i class="fa fa-caret-down" ng-show="sort.bulkJobList =='booked'"></i><i class="fa fa-caret-up" ng-show="sort.bulkJobList =='d-booked'"></i></th>
        <th scope="col" ng-click="orderList('bulkJobList', 'status')">Status <i class="fa fa-caret-down" ng-show="sort.bulkJobList =='status'"></i><i class="fa fa-caret-up" ng-show="sort.bulkJobList =='d-status'"></i></th>
		<th scope="col" ng-click="orderList('bulkJobList', 'speed')">Speed <i class="fa fa-caret-down" ng-show="sort.bulkJobList =='speed'"></i><i class="fa fa-caret-up" ng-show="sort.bulkJobList =='d-speed'"></i></th>
        <th scope="col" ng-click="orderList('bulkJobList', 'jobNo')">Job <i class="fa fa-caret-down" ng-show="sort.bulkJobList =='jobNo'"></i><i class="fa fa-caret-up" ng-show="sort.bulkJobList =='d-jobNo'"></i></th>
        <th scope="col" ng-click="orderList('bulkJobList', 'client')">Client <i class="fa fa-caret-down" ng-show="sort.bulkJobList =='client'"></i><i class="fa fa-caret-up" ng-show="sort.bulkJobList =='d-client'"></i></th>
        <th scope="col" ng-click="orderList('bulkJobList', 'from')">From <i class="fa fa-caret-down" ng-show="sort.bulkJobList =='from'"></i><i class="fa fa-caret-up" ng-show="sort.bulkJobList =='d-from'"></i></th>
        <th scope="col" ng-click="orderList('bulkJobList', 'to')">To <i class="fa fa-caret-down" ng-show="sort.bulkJobList =='to'"></i><i class="fa fa-caret-up" ng-show="sort.bulkJobList =='d-to'"></i></th>
		<th scope="col" ng-click="orderList('bulkJobList','to')">Street <i class="fa fa-caret-down" ng-show="sort.bulkJobList == 'to'"></i><i class="fa fa-caret-up" ng-show="sort.bulkJobList == 'd-to'"></i></th>
        
        </tr>
        </thead>
    </table>


</div>

    <table class="table table-striped table-responsive table-rows" id="bulkJobList" data-group="bulkJobList">
    <thead class="thead-dark no select">

    </tr>
    </thead>
    <tbody>
    <tr class="droppable-row draggable-row clickable-row noselect" ng-repeat="job in bulkJobList | filter: box.searchBox"  ng-click="selectBulkJobDetail(job.id);" data-courier="{{job.courier}}" data-jobid="{{job.id}}" data-jobNo="{{job.jobNo}}">
            <td>{{job.booked | date : "dd/MM/yy hh:mm"}}</td>
            <td class="status" ng-class="job.status">{{job.status}}</td>
            <td right-click action="speedColumnClick(event)">{{job.speed}}</td>

            <td>{{job.jobNo}}</td>
            <td right-click action="clientColumnClick(event)">{{job.client}}</td>
            <td right-click action="fromColumnClick(event)">{{job.from}} <i ng-if="!job.pickUpLongitude" class="fa fa-exclamation"></i></td>
			<td right-click action="toColumnClick(event)">{{job.to}} <i ng-if="!job.deliveryLongitude" class="fa fa-exclamation"></i></td>
			<td context-menu="setCurrentWorkMenu"><div style="width:200px; white-space:nowrap; overflow-x:hidden;" title="{{job.toAddress}}">{{job.toAddress}}</div></td>

        </tr>
        <tr>
            <td><div></div></td>
            <td><div></div></td>
            <td><div></div></td>
            <td><div></div></td>
            <td><div></div></td>
            <td><div></div></td>
            <td><div></div></td>
            <td><div></div></td>

        </tr>
    </tbody>
    <tfoot>  
        <tr>  
            <td align="center" colspan="6">  
                <!--<span class="form-group pull-left page-size form-inline">  
                    <select id="ddlPageSize" class="form-control control-color"  
                            ng-model="pageSizeSelected"  
                            ng-change="changePageSize(pageSizeSelected)">  
                        <option value="5">5</option>  
                        <option value="10">10</option>  
                        <option value="25">25</option>  
                        <option value="50">50</option>  
                    </select>  
                </span>  -->
            
                <div class="pull-right">  
                    <uib-pagination total-items="bulkTotalCount" ng-change="bulkPageChanged(bulkPageIndex)" items-per-page="bulkPageSizeSelected" 
                    direction-links="true" ng-model="bulkPageIndex" max-size="maxSize" class="pagination" boundary-links="true" rotate="false"
                    num-pages="bulkNumPages"></uib-pagination>  
                    <a class="btn btn-primary">Page: {{bulkPageIndex}} / {{bulkNumPages}}</a>  
                </div>  
            </td>  
        </tr>  
    </tfoot>  
</table>
    

</div>

<div class="loading">
    <div class="text">
        <i class="fa fa-refresh fa-spin fa-3x fa-fw"></i>
        <span class="sr-only">Loading...</span>
    </div>
</div>



<script>

    $(".box-content").on("scroll", function() {

        var newTop2 = $(this).scrollTop(); 
        $(this).find(".box-calculator").css({"top":newTop2});

    });

</script>