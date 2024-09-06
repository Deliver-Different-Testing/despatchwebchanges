<div class="overlay-map-fix"></div>

<div map-lazy-load="https://maps.google.com/maps/api/js" map-lazy-load-params="{{googleMapsUrl}}"
     ng-if="googleMapsUrl">
    <ng-map center="[-36.8484, 174.7633]" id="map" map-type-id="ROADMAP" on-bounds_changed="boundsChanged()"
            style="width:100%;height:100%;"
            zoom="11">
        <traffic-layer></traffic-layer>
    </ng-map>
</div>
