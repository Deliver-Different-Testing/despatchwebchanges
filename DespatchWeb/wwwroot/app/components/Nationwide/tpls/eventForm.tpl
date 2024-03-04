
<div class="eventForm">

  <div class="event-box">
    <div class="event-title">ADD EVENT</div>
    <div class="container-fluid">
      <div class="row">
        <div class="col-md-6">

          <div class="form-group">
            <label for="jobNum">Job Number:</label>
            <input type="text" readonly class="form-control" ng-model="eventForm.data.jobNum">
          </div>
           

          <div class="form-group">
            <label for="date">Event Date:</label>
            <input  readonly type="date" class="form-control" ng-model="eventForm.data.date">
          </div>

          <div class="form-group">
            <label for="time">Event Time:</label>
            <input readonly type="time" class="form-control" ng-model="eventForm.data.time">
          </div>

          
          
          
          
          
        </div>
        <div class="col-md-6">

         <div class="form-group">
            <label for="client">Client:</label>
            <input type="text" readonly class="form-control" ng-model="eventForm.data.client">
          </div>       

          <div class="form-group">
            <label for="event">Event:</label>
            <select name="event-type" id="event-type" placeholder="choose event type"  ng-model="eventForm.data.event" class="form-control focusMe">
            </select>
          </div>

          
          
      
          
        </div>
        <div class="col-md-12">
            
          <div class="form-group">
            <label for="type">Notes:</label>
            <textarea class="form-control" id="type" ng-model="eventForm.data.notes"></textarea>  
          </div>
        

        <button class="btn btn-primary" ng-click="eventForm.submit()">Add Event</button>
        <button class="btn btn-default" ng-click="eventForm.cancel()">Cancel</button>

        </div>
      </div>
    </div>
  </div>
</div>

