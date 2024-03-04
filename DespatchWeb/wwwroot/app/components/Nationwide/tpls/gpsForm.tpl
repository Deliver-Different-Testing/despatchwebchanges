
<div class="gpsForm">

  <div class="gps-box">
    UPDATE ADDRESS & GPS
    <div class="container-fluid">
      <div class="row">
        <div class="col-md-12">
          <div class="form-group">
            <label for="jobNum">Listed Address:</label>
            <div class="input-group">
              <input type="text" ng-model="jdSvc.gpsForm.data.address" class="form-control" />
              <div class="input-group-btn">
                <button class="btn btn-default" type="button" ng-click="jdSvc.copyGpsAddress()">Copy to search</button>
              </div>
            </div>
          </div>
        </div>
        <div class="col-md-6">
            <div class="form-group">
              <label for="jobNum">Latitude:</label>
              <input type="text" ng-model="jdSvc.gpsForm.data.lat" class="form-control" />
            </div>
        </div>
        <div class="col-md-6">
            <div class="form-group">
              <label for="jobNum">Longtitude:</label>
              <input type="text" ng-model="jdSvc.gpsForm.data.long" class="form-control" />
            </div>
        </div>
		<div class="col-md-6">
            <div class="form-group">
              <label>Suburb:</label>
              <input type="text" id="suburb" ng-model="jdSvc.gpsForm.data.suburb" class="form-control" />
            </div>
        </div>
        <div class="col-md-6">
            <div class="form-group">
              <label>Mapped to (our Suburb):</label><i ng-if="jdSvc.gpsForm.data.our_suburb === undefined" class="fa fa-exclamation"></i>
              <select id="our_suburb" data-width="100%" ng-model="jdSvc.gpsForm.data.our_suburb" ng-required="true"></select>
            </div>
        </div>
        <div class="col-md-12">

          <div class="form-group">
            <label for="jobNum">Search Address:</label>
			<select id="location" data-placeholder="Enter your address" data-width="100%"></select>
          </div>
          
        </div>

        <div class="col-md-12">
            
          <div class="form-group">
            <label for="type">Map:</label>/
			 <ng-map id="map" center="[{{jdSvc.gpsForm.data.lat || -36.850657}}, {{jdSvc.gpsForm.data.long ||  174.764660}}]" on-rightclick="jdSvc.gpsForm.moveMarker()">
			 <marker position="{{jdSvc.gpsForm.data.lat}}, {{jdSvc.gpsForm.data.long}}" draggable="true" on-dragend="jdSvc.gpsForm.markerDragend()"></marker>
			 </ng-map>	
          </div>

        <button class="btn btn-primary"  promise-btn ng-click="jdSvc.gpsForm.submit(jdSvc.gpsForm.details.geometry.location)">UPDATE</button>
        <button class="btn btn-default" ng-click="jdSvc.gpsForm.cancel()">Cancel</button>

        </div>
      </div>
    </div>
  </div>
</div>

