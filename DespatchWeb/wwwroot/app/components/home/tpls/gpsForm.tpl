
<div class="gpsForm">

  <div class="gps-box">
    UPDATE ADDRESS & GPS
    <div class="container-fluid">
      <div class="row">
        <div class="col-md-12">
          <div class="form-group">
            <label for="jobNum">Listed Address:</label>
            <div class="input-group">
              <input type="text" ng-model="gpsForm.data.address" class="form-control" />
              <div class="input-group-btn">
                <button class="btn btn-default" type="button" ng-click="copyGpsAddress()">Copy to search</button>
              </div>
            </div>
          </div>
        </div>
        <div class="col-md-6">
            <div class="form-group">
              <label for="jobNum">Latitude:</label>
              <input type="text" ng-model="gpsForm.data.lat" class="form-control" />
            </div>
        </div>
        <div class="col-md-6">
            <div class="form-group">
              <label for="jobNum">Longtitude:</label>
              <input type="text" ng-model="gpsForm.data.long" class="form-control" />
            </div>
        </div>
		<div class="col-md-6">
            <div class="form-group">
              <label>Suburb:</label>
              <input type="text" id="suburb" ng-model="gpsForm.data.suburb" class="form-control" />
            </div>
        </div>
        <div class="col-md-6">
            <div class="form-group">
              <label>Mapped to (our Suburb):</label><i ng-if="gpsForm.data.our_suburb === undefined" class="fa fa-exclamation"></i>
              <select id="our_suburb" data-width="100%" ng-model="gpsForm.data.our_suburb" ng-required="true"></select>
            </div>
        </div>
        <div class="col-md-12">

          <div class="form-group">
            <label for="jobNum">Search Address:</label>
            <!--<input type="text" id="gpsSearch" ng-map-autocomplete ng-model="gpsForm.search" options='{"watchEnter":true}' ng-model-options='{"debounce": 1000}' details="gpsForm.details" class="form-control" />-->
			<select id="location" data-placeholder="Enter your address" data-width="100%"></select>
          </div>
          
        </div>

        <div class="col-md-12">
            
          <div class="form-group">
            <label for="type">Map:</label>/
			 <ng-map id="map" center="[{{gpsForm.data.lat || -36.850657}}, {{gpsForm.data.long ||  174.764660}}]" on-rightclick="gpsForm.moveMarker()">
			 <marker position="{{gpsForm.data.lat}}, {{gpsForm.data.long}}" draggable="true" on-dragend="gpsForm.markerDragend()"></marker>
			 </ng-map>	
            <!--
			<iframe
              width="450"
              height="250"
              frameborder="0" style="border:0"
              id="gpsMap"
              data-src="https://www.google.com/maps/embed/v1/place?key=AIzaSyC9qU2-Zu7KwkO6TqtY5p-2P4czmpF98nA&q=" allowfullscreen>
            </iframe>
			-->
          </div>

        <button class="btn btn-primary"  promise-btn ng-click="gpsForm.submit(gpsForm.details.geometry.location)">UPDATE</button>
        <button class="btn btn-default" ng-click="gpsForm.cancel()">Cancel</button>

        </div>
      </div>
    </div>
  </div>
</div>

