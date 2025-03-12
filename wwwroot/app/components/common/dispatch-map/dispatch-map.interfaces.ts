import angular from "angular";

export interface DispatchMapControllerScope extends angular.IScope {
    mapCenter: google.maps.LatLng | google.maps.LatLngLiteral;
    mapZoom: number;
    jobs: any[];
    currentJob: any;
    courierPositions: any[];
    onMarkerClick: (args: {job: any}) => void;
    showAvailableCouriers: boolean;
    showJobLines: boolean;
    autoZoomEnabled: boolean;
    map: google.maps.Map;
    tooltip: google.maps.InfoWindow;
    markers: google.maps.Marker[];
    flags: google.maps.Marker[];
    labels: google.maps.Marker[];
    polylines: google.maps.Polyline[];
    googleMapsUrl: string | null;
}
