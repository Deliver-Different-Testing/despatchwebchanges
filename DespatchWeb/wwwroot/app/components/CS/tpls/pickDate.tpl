<div class="dateService" ng-cloak ng-controller="CSControl as ctrl">
    <div class="container-fluid space">
        <label id="dateRange" class="label-padding">Quick Search: </label>
        <md-radio-group ng-change="ctrl.onSearchRangeChange(ctrl.dateSearchRange)" ng-model="ctrl.dateSearchRange"
                        aria-labelledby="dateRange" layout="row" layout-align="center center">
            <md-radio-button value="1">Fortnight</md-radio-button>
            <md-radio-button value="2">Today</md-radio-button>
            <md-radio-button value="3">Month</md-radio-button>
            <md-radio-button value="4">Custom</md-radio-button>
        </md-radio-group>

        <md-divider></md-divider>

        <div class="space" layout="column" layout-align="center end" ng-if="ctrl.dateSearchRange == 4">
            <div>
                <label id="from-datepicker-header">From: </label>
                <md-datepicker
                        input-aria-describedby="from-datepicker-description"
                        input-aria-labelledby="from-datepicker-header "
                        md-placeholder="Enter date"
                        ng-model="ctrl.pickDateService.from_date"></md-datepicker>
                <p id="from-datepicker-description" style="display: none">
                    Start date search
                </p>
            </div>

            <div>
                <label id="datepicker-header">To: </label>
                <md-datepicker
                        input-aria-describedby="to-datepicker-description"
                        input-aria-labelledby="to-datepicker-header "
                        md-placeholder="Enter date"
                        ng-model="ctrl.pickDateService.to_date"></md-datepicker>
                <p id="to-datepicker-description" style="display: none">
                    End date search
                </p>
            </div>
        </div>

        <div class="space">
            <label id="clientLabel">Client:</label>
            <md-autocomplete
                    input-aria-labelledby="clientLabel"
                    md-clear-button="true"
                    md-item-text="item.text"
                    md-items="item in ctrl.clientQuerySearch(ctrl.clientSearchText)"
                    md-min-length="3"
                    md-search-text="ctrl.clientSearchText"
                    md-selected-item="ctrl.selectedClient"
                    md-selected-item-change="ctrl.selectedClientChange(ctrl.selectedClient)"
                    placeholder="Start typing to enter new client...">
                <md-item-template>
                    <span md-highlight-flags="^i" md-highlight-text="ctrl.clientSearchText">{{item.text}}</span>
                </md-item-template>
                <md-not-found>
                    No clients matching "{{ctrl.clientSearchText}}" were found.
                </md-not-found>
            </md-autocomplete>
        </div>

        <div class="space">
            <label id="courierLabel">Courier:</label>
            <md-autocomplete
                    md-items="item in ctrl.courierQuerySearch(ctrl.courierSearchText)"
                    md-search-text="ctrl.courierSearchText"
                    md-selected-item="ctrl.selectedCourier"
                    md-selected-item-change="ctrl.selectedCourierChange(ctrl.selectedCourier)"
                    md-item-text="item.text"
                    md-min-length="3"
                    placeholder="Start typing to enter new courier..."
                    input-aria-labelledby="courierLabel"
                    md-clear-button="true">
                <md-item-template>
                    <span md-highlight-flags="^i" md-highlight-text="ctrl.courierSearchText">{{item.text}}</span>
                </md-item-template>
                <md-not-found>
                    No couriers matching "{{ctrl.courierSearchText}}" were found.
                </md-not-found>
            </md-autocomplete>
        </div>

        <md-divider></md-divider>

        <div class="space">
            <b>Job Number:</b>
            <md-input-container class="md-block">
                <input id="Job" name="Job" ng-model="ctrl.pickDateService.job"
                       type="text">
            </md-input-container>
        </div>

        <div class="space">
            <b>Everything Else (JobNo, Address, Name, Refs):</b>
            <md-input-container class="md-block">
                <input id="Wild" name="Wild" ng-model="ctrl.pickDateService.wild"
                       type="text">
            </md-input-container>
        </div>

        <section layout="row" layout-sm="column" layout-align="center center" layout-wrap class="space">
            <md-button class="md-raised md-primary" ng-click="ctrl.refreshAllData()">
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
