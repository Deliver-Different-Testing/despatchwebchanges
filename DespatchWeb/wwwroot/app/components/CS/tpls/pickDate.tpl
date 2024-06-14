<div class="dateService">
    <div class="container-fluid space">
        <label id="dateRange" class="label-padding">Quick Search: </label>
        <md-radio-group ng-model="dateSearchRange" ng-change="onSearchRangeChange(dateSearchRange)"
                        aria-labelledby="dateRange" layout="row" layout-align="center center">
            <md-radio-button value="Today" class="md-primary">Today</md-radio-button>
            <md-radio-button value="Month">Month</md-radio-button>
            <md-radio-button value="Custom">Custom</md-radio-button>
        </md-radio-group>
        <md-divider></md-divider>
        <div ng-if="dateSearchRange == 'Custom'" class="space">
            <label>From: </label><span>{{currentFromDate | date: DEFAULT_DATE_FORMAT}}</span>
            <div class="btn-group" role="group" aria-label="Basic example">
                <button type="button" class="btn btn-sm btn-secondary" title="Choose From Date"
                        ng-click="chooseFromDate()"><i class="fa fa-calendar"></i></button>
            </div>
            <label>To: </label><span>{{currentToDate | date: DEFAULT_DATE_FORMAT}}</span>
            <div class="btn-group" role="group" aria-label="Basic example">
                <button type="button" class="btn btn-sm btn-secondary" title="Choose To Date"
                        ng-click="chooseToDate()"><i class="fa fa-calendar"></i></button>
            </div>
        </div>
        <div class="space">
            <b>Client:</b>
            <select name="FilterClient" id="FilterClient" allow-clear="true" ng-model="pickDateService.client"
                    class="form-control focusMe">
                <option value=""></option>
            </select>
        </div>
        <div class="space">
            <b>Courier:</b>
            <select name="FilterCourier" id="FilterCourier" allow-clear="true" ng-model="pickDateService.courier"
                    class="form-control focusMe">
                <option value=""></option>
            </select>
        </div>
        <div class="space">
            <b>Job Number:</b>
            <input type="text" name="Job" id="Job" ng-model="pickDateService.job" class="form-control focusMe"/>
        </div>
        <div class="space">
            <b>Everything Else (JobNo, Address, Name, Refs):</b>
            <input type="text" name="Wild" id="Wild" ng-model="pickDateService.wild" class="form-control focusMe"/>
        </div>
        <section layout="row" layout-sm="column" layout-align="center center" layout-wrap class="space">
            <md-button class="md-raised md-primary" ng-click="refreshAllData(true)">Search</md-button>
        </section>
    </div>
</div>

<style>
    .label-padding {
        padding: 10px;
    }

    .space {
        margin-bottom: 20px;
    }
</style>
