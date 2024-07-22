<div id="map_canvas" style="width:100%;height:100%;"></div>

<script src="app/components/CS/tpls/map.js"></script>

<div ng-if="!isAdmin" class="noteToUser">Please note that the courier may have other jobs on this route other than the ones shown.</div>
<div class="loading">
    <div class="text">
        <i class="fa fa-refresh fa-spin fa-3x fa-fw"></i>
        <span class="sr-only">Loading...</span>
    </div>
</div>
<div class="no-data" ng-if="defaultRun.length == 0">
    <div class="text">Please select a run with jobs</div>
</div>
