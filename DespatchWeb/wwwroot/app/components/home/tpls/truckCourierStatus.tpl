
<div class="truckCourierStatusForm">

  <div class="event-box">
    <div class="event-title">Truck Loading Status for <span readonly ng-bind-template="{{truckCourierStatusForm.data.courierCode}} {{truckCourierStatusForm.data.firstName}}"></div>
    <div class="container-fluid">
      <div class="row">
        <div class="col-md-6">

          <div class="form-group">
            <label for="maxPallets">Max Pallets:</label>
            <input  readonly type="text" class="form-control" ng-model="truckCourierStatusForm.data.maxPallets">
          </div>
           

          <div class="form-group">
            <label for="maxWeight">Max Weight:</label>
            <input  readonly type="text" class="form-control" ng-model="truckCourierStatusForm.data.maxPayLoad">
          </div>

          <div class="form-group">
            <label for="availablePallets">Available Pallets:</label>
            <input  readonly type="text" class="form-control highlight" ng-model="truckCourierStatusForm.data.availablePallets">
          </div>

          
          
          
          
          
        </div>
        <div class="col-md-6">

         <div class="form-group">
            <label for="currentPallets">Current Pallets:</label>
            <input  readonly type="text" class="form-control highlight" ng-model="truckCourierStatusForm.data.currentPallets">
          </div>
           

          <div class="form-group">
            <label for="currentWeight">Current Weight:</label>
            <input  readonly type="text" class="form-control highlight" ng-model="truckCourierStatusForm.data.currentWeight">
          </div>

          <div class="form-group">
            <label for="availableWeight">Available Weight:</label>
            <input  readonly type="text" class="form-control highlight" ng-model="truckCourierStatusForm.data.availableWeight">
          </div>
          
          
      
          
        </div>
        <div class="col-md-12">
            
          

        <button class="btn btn-primary" ng-click="truckCourierStatusForm.refresh()">Refresh</button>
        <button class="btn btn-default" ng-click="truckCourierStatusForm.close()">Close</button>

        </div>
      </div>
    </div>
  </div>
</div>

