<div class="dateService">

    <div class="container-fluid">
        <br/>

		<label>Quick Search: </label>
		<md-radio-group ng-model="data.searchRange" aria-labelledby="searchRange" layout="row"  layout-align="center center" >
			<md-radio-button value="Today" class="md-primary">Today</md-radio-button>
			<md-radio-button value="Month">Month</md-radio-button>
		</md-radio-group>

		<md-divider></md-divider>
		<br/>

        <div>
            <label>From: </label><span>{{currentFromDate | date : "dd/MM/yyyy"}}</span>
                <div class="btn-group" role="group" aria-label="Basic example">
                    <button type="button" class="btn btn-sm btn-secondary" title="Choose From Date"
                            ng-click="chooseFromDate()"><i class="fa fa-calendar"></i></button>
                </div>
                <label>To: </label>{{currentToDate | date : "dd/MM/yyyy"}}</span>
                    <div class="btn-group" role="group" aria-label="Basic example">
                        <button type="button" class="btn btn-sm btn-secondary" title="Choose To Date"
                                ng-click="chooseToDate()"><i class="fa fa-calendar"></i></button>
                    </div>
        </div>
        <br/>
        <div>

            <b>Client:</b> <br/>

            <select name="FilterClient" id="FilterClient" allow-clear="true" ng-model="pickDateService.client"
                    class="form-control focusMe">
                <option value=""></option>
            </select>
            <br/>

        </div>

        <br/>
        <b>Courier:</b> <br/>
        <select name="FilterCourier" id="FilterCourier" allow-clear="true" ng-model="pickDateService.courier"
                class="form-control focusMe">
            <option value=""></option>
        </select>
        <br/>

        <br/>
        <b>Job Number:</b> <br/>
        <input type="text" name="Job" id="Job" ng-model="pickDateService.job" class="form-control focusMe"

        <br/>
        <br/>
        <b>Everything Else (JobNo, Address, Name, Refs):</b> <br/>
        <input type="text" name="Wild" id="Wild" ng-model="pickDateService.wild" class="form-control focusMe"

        <br/>


        <br/>

        <section layout="row" layout-sm="column" layout-align="center center" layout-wrap>
            <md-button class="md-raised md-primary" ng-click="refreshAllData(true)">Search</md-button>
        </section>

        <br/>
        <br/>

   </div>
</div>
