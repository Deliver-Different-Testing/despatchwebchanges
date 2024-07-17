<div class="dateService">
    <div class="container-fluid space">
        <label id="dateRange" class="label-padding">Quick Search: </label>
        <md-radio-group ng-model="dateSearchRange" ng-change="onSearchRangeChange(dateSearchRange)"
                        aria-labelledby="dateRange" layout="row" layout-align="center center">
            <md-radio-button value="1">Fortnight</md-radio-button>
            <md-radio-button value="2">Today</md-radio-button>
            <md-radio-button value="3">Month</md-radio-button>
            <md-radio-button value="4">Custom</md-radio-button>
        </md-radio-group>
        <md-divider></md-divider>

        <div class="space" ng-if="dateSearchRange == 4">
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
            <label id="clientLabel">Client:</label>
            <md-autocomplete
                    input-aria-labelledby="clientLabel"
                    md-clear-button="true"
                    md-item-text="item.text"
                    md-items="item in clientQuerySearch(clientSearchText)"
                    md-min-length="3"
                    md-search-text="clientSearchText"
                    md-selected-item="clientSelectedItem"
                    md-selected-item-change="selectedClientChange(item)"
                    placeholder="Start typing to enter new client...">
                <md-item-template>
                    <span md-highlight-text="searchText" md-highlight-flags="^i">{{item.text}}</span>
                </md-item-template>
                <md-not-found>
                    No clients matching "{{searchText}}" were found.
                </md-not-found>
            </md-autocomplete>
        </div>

        <div class="space">
            <label id="courierLabel">Courier:</label>
            <md-autocomplete
                    md-selected-item="courierSelectedItem"
                    md-search-text="courierSearchText"
                    md-selected-item-change="selectedCourierChange(item)"
                    md-items="item in courierQuerySearch(courierSearchText)"
                    md-item-text="item.text"
                    md-min-length="3"
                    placeholder="Start typing to enter new courier..."
                    input-aria-labelledby="courierLabel"
                    md-clear-button="true">
                <md-item-template>
                    <span md-highlight-text="searchText" md-highlight-flags="^i">{{item.text}}</span>
                </md-item-template>
                <md-not-found>
                    No couriers matching "{{searchText}}" were found.
                </md-not-found>
            </md-autocomplete>
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
            <md-button class="md-raised md-primary" ng-click="refreshAllData(true)">
                <md-icon md-font-set="material-symbols-outlined">search</md-icon>
                Search
            </md-button>
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
