    <div class="dateService">
      
      <div class="container-fluid">
            <br />
			<div>
				<label>From: <label><span>{{currentFromDate | date : "dd/MM/yyyy"}}</span>
                <div class="btn-group" role="group" aria-label="Basic example">
                    <button type="button" class="btn btn-sm btn-secondary" title="Choose From Date" ng-click="chooseFromDate()"><i class="fa fa-calendar"></i></button>
                </div>
				<label>To: <label>{{currentToDate | date : "dd/MM/yyyy"}}</span>
                <div class="btn-group" role="group" aria-label="Basic example">
                    <button type="button" class="btn btn-sm btn-secondary" title="Choose To Date" ng-click="chooseToDate()"><i class="fa fa-calendar"></i></button>
                </div>
			</div>
			<br/>
			<div>

				<b>Client:</b> <br />
				
				<select name="FilterClient" id="FilterClient" allow-clear="true"  ng-model="pickDateService.client" class="form-control focusMe">
					<option value=""></option>
				</select>
				<br />

			</div>

			<br />
            <b>Courier:</b> <br />
			<select name="FilterCourier" id="FilterCourier" allow-clear="true"  ng-model="pickDateService.courier" class="form-control focusMe">
				<option value=""></option>
			</select>
            <br />

			<br />
            <b>Job Number:</b> <br />
			<input type="text" name="Job" id="Job" ng-model="pickDateService.job" class ="form-control focusMe"

            <br />
			<br />
            <b>Everything Else (JobNo, Address, Name, Refs):</b> <br />
			<input type="text" name="Wild" id="Wild" ng-model="pickDateService.wild" class ="form-control focusMe"

            <br />

			

			<br />
			<div class="btn btn-primary" ng-click="refreshAllData(true)">Search</div>

			<br />
			<br />


        </div>
      </div>


    

    </div>

