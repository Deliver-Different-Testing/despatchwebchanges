<md-dialog aria-label="Update Address and GPS" style="width: 50%;">
    <form ng-cloak>
        <md-toolbar>
            <div class="md-toolbar-tools">
                <h2>{{ title }}</h2>
                <span flex></span>
                <md-button class="md-icon-button" ng-click="cancel()">
                    <md-icon aria-label="Close dialog" md-font-set="material-symbols-outlined">
                        close
                    </md-icon>
                </md-button>
            </div>
        </md-toolbar>

        <md-dialog-content>
            <div class="md-dialog-content">

                <div layout-gt-xs="row">
                    <md-input-container class="md-block" flex-gt-xs>
                        <label for="address">Address</label>
                        <input id="address" ng-model="addressDetails.address">
                    </md-input-container>

                    <md-button class="md-fab md-mini md-raised" ng-click="copyGpsAddress(addressDetails.address)">
                        <md-icon md-font-set="material-symbols-outlined">content_copy</md-icon>
                        <md-tooltip md-direction="bottom">Copy To Search</md-tooltip>
                    </md-button>
                </div>


                <div layout-gt-sm="row">
                    <md-input-container class="md-block" flex-gt-sm>
                        <label for="lat">Latitude</label>
                        <input id="lat" ng-model="addressDetails.lat">
                    </md-input-container>

                    <md-input-container class="md-block" flex-gt-sm>
                        <label for="long">Longtitude</label>
                        <input id="long" ng-model="addressDetails.long">
                    </md-input-container>
                </div>

                <div layout-gt-sm="row">
                    <md-input-container class="md-block" flex-gt-sm>
                        <label for="suburb">Suburb</label>
                        <input id="suburb" ng-model="addressDetails.suburb">
                    </md-input-container>

                    <md-autocomplete class="md-block" flex-gt-sm
                                     md-floating-label="Our Suburb"
                                     md-item-text="item.text"
                                     md-items="item in ourSuburbSearch(ourSuburbSearchText)"
                                     md-search-text="ourSuburbSearchText"
                                     md-selected-item="ourSuburbSelectedItem">
                        <md-item-template>
                            <span md-highlight-flags="^i" md-highlight-text="searchText">{{item.text}}</span>
                        </md-item-template>
                        <md-not-found>
                            No matches found for "{{searchText}}" in Suburb.
                        </md-not-found>
                    </md-autocomplete>
                </div>

                <md-input-container class="md-block">
                    <label for="extras">Address Extras</label>
                    <input id="extras" ng-model="addressDetails.extras">
                </md-input-container>

                <md-autocomplete class="md-block" flex-gt-sm
                                 md-floating-label="Search Address"
                                 md-item-text="item.text"
                                 md-items="item in addressSearchAutocomplete(addressSearchText)"
                                 md-min-length="3"
                                 md-search-text="addressSearchText"
                                 md-selected-item="addressDetails.filledAddress"
                                 md-selected-item-change="addressSearchItemSelected(item)">
                    <md-item-template>
                        <span md-highlight-flags="^i" md-highlight-text="addressSearchText">{{item.text}}</span>
                    </md-item-template>
                    <md-not-found>
                        No addresses matching "{{addressSearchText}}" were found.
                    </md-not-found>
                </md-autocomplete>

                <label>Map</label>
                <ng-map center="[{{addressDetails.lat || -36.850657}}, {{addressDetails.long ||  174.764660}}]"
                        id="map"
                        on-rightclick="moveMarker()">
                    <marker draggable="true" on-dragend="markerDragend()"
                            position="{{addressDetails.lat}}, {{addressDetails.long}}"></marker>
                </ng-map>
            </div>
        </md-dialog-content>

        <md-dialog-actions layout="row" layout-align="center center">
            <md-button class="md-raised md-primary" ng-click="submit(addressDetails)">
                Update
            </md-button>
        </md-dialog-actions>
    </form>
</md-dialog>
