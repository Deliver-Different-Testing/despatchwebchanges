
<div class="droppable-box" style="min-height:500px">

   <div class="table-headings">
    <table>
        <thead class="thead-dark no select">
        <tr>
        <th scope="col" ng-click="orderList('jobList', 'Booked')">Booked <i class="fa fa-caret-down" ng-show="sort.jobList =='booked'"></i><i class="fa fa-caret-up" ng-show="sort.jobList =='d-booked'"></i></th>
        <th scope="col" ng-click="orderList('jobList', 'speed')">Speed <i class="fa fa-caret-down" ng-show="sort.jobList =='speed'"></i><i class="fa fa-caret-up" ng-show="sort.jobList =='d-speed'"></i></th>
        <th scope="col" ng-click="orderList('jobList', 'jobNo')">Job <i class="fa fa-caret-down" ng-show="sort.jobList =='jobNo'"></i><i class="fa fa-caret-up" ng-show="sort.jobList =='d-jobNo'"></i></th>
        <th scope="col" ng-click="orderList('jobList', 'client')">Client <i class="fa fa-caret-down" ng-show="sort.jobList =='client'"></i><i class="fa fa-caret-up" ng-show="sort.jobList =='d-client'"></i></th>
        <th scope="col" ng-click="orderList('jobList', 'from')">From <i class="fa fa-caret-down" ng-show="sort.jobList =='from'"></i><i class="fa fa-caret-up" ng-show="sort.jobList =='d-from'"></i></th>
        <th scope="col" ng-click="orderList('jobList', 'to')">To <i class="fa fa-caret-down" ng-show="sort.jobList =='to'"></i><i class="fa fa-caret-up" ng-show="sort.jobList =='d-to'"></i></th>
        <th scope="col" ng-click="orderList('jobList', 'code')">Code <i class="fa fa-caret-down" ng-show="sort.jobList =='code'"></i><i class="fa fa-caret-up" ng-show="sort.jobList =='d-code'"></i></th>
        <th>S</th>
        <th>V</th>

        
        </tr>
        </thead>
    </table>


</div>

    <table class="table table-striped table-responsive table-rows" id="pbList" data-group="pbList">
    <thead class="thead-dark no select">

    </tr>
    </thead>
    <tbody>
    <tr class="droppable-row draggable-row clickable-row noselect" ng-repeat="job in pbList | filter: box.searchBox"  ng-mouseup="selectPreBookDetail(job.id);" data-courier="{{job.courier}}" data-jobid="{{job.id}}" data-jobNo="{{job.jobNo}}">
            <td>{{job.booked | date : "hh:mm"}}</td>
            <td> {{job.speed}}</td>
            <td>{{job.jobNo}}</td>
            <td right-click action="clientColumnClick(event)">{{job.client}}</td>
            <td context-menu="setCurrentWorkMenu"><div title="{{job.fromAddress}}">{{job.fromAddress}}</div></td>
            <td context-menu="setCurrentWorkMenu"><div  title="{{job.toAddress}}">{{job.toAddress}}</div></td>
            <td>{{job.courier}}</td>
			<td ng-click="sendPrebookJob(job.id);" title="Send"><i class="fa fa-paper-plane"></i></td>
            <td ng-click="voidPrebookJob(job.id);" title="Void"><i  class="fa fa-remove"></i></td>

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
                    <uib-pagination total-items="pbTotalCount" ng-change="pbPageChanged(pbPageIndex)" items-per-page="pbPageSizeSelected" 
                    direction-links="true" ng-model="pbPageIndex" max-size="maxSize" class="pagination" boundary-links="true" rotate="false"
                    num-pages="pbNumPages"></uib-pagination>  
                    <a class="btn btn-primary">Page: {{pbPageIndex}} / {{pbNumPages}}</a>  
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