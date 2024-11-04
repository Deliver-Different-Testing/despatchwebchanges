/**
 * @fileoverview Service for managing layout configurations on the nationwide page
 * @module NationwideLayoutService
 */
class NationwideLayoutService {
    /**
     * Create a NationwideLayoutService.
     * @param {Object} $window
     * @param {Object} $mdDialog
     * @param {Object} $rootScope
     */
    constructor($window, $mdDialog, $rootScope) {
        this._$window = $window;
        this._$mdDialog = $mdDialog;
        this._$rootScope = $rootScope;

        /** @type {boolean} */
        this.shouldDisplayFlightTable = true;

        // Column width options
        /** @type {string} */
        this.COL_WIDTH_LARGE = "35%";
        /** @type {string} */
        this.COL_WIDTH_MEDIUM = "30%";

        // Box height options
        /** @type {string} */
        this.BOX_HEIGHT_LARGE = "60%";
        /** @type {string} */
        this.BOX_HEIGHT_MEDIUM = "50%";
        /** @type {string} */
        this.BOX_HEIGHT_SMALL = "40%";
        /** @type {string} */
        this.BOX_HEIGHT_XSMALL = "30%";

        // Define individual boxes
        /** @type {Box} */
        this.jobsListBox = {name: "jobsList", height: this.BOX_HEIGHT_LARGE};
        /** @type {Box} */
        this.jobsListPODBox = {name: "jobsListPOD", height: this.BOX_HEIGHT_SMALL};
        /** @type {Box} */
        this.jobsListDeliveryBox = {name: "jobsListDelivery", height: this.BOX_HEIGHT_MEDIUM};
        /** @type {Box} */
        this.jobsListRepriceBox = {name: "jobsListReprice", height: this.BOX_HEIGHT_MEDIUM};
        /** @type {Box} */
        this.flightDataTableBox = {name: "flightDataTable", height: this.BOX_HEIGHT_XSMALL};
        /** @type {Box} */
        this.mapTableBox = {name: "map", height: this.BOX_HEIGHT_XSMALL};
        /** @type {Box} */
        this.jobDetailBox = {name: "jobDetail", height: this.BOX_HEIGHT_LARGE};
        /** @type {Box} */
        this.agentDataTableBox = {name: "agentDataTable", height: this.BOX_HEIGHT_XSMALL};

        // Define columns
        this.column1 = {};
        this.updateColumn1Layout();

        /** @type {Column} */
        this.column2 = {
            id: "col2", width: this.COL_WIDTH_LARGE, boxes: [this.jobDetailBox, this.mapTableBox]
        };
        /** @type {Column} */
        this.column3 = {
            id: "col3",
            width: this.COL_WIDTH_MEDIUM,
            boxes: [this.jobsListPODBox, this.jobsListDeliveryBox, this.jobsListRepriceBox]
        };

        // Construct the layout
        /** @type {Layout[]} */
        this.defaultLayout = [{
            name: "Default", layout: {
                columns: [this.column1, this.column2, this.column3]
            }
        }];

        /** @type {Layout[]|null} Current layouts */
        this.currentLayouts = null;
        /** @type {Layout[]|null} Layouts object */
        this.layoutsObject = null;
        /** @type {Object} Map zoom configuration */
        this.mapZoom = {display: true};
        /** @type {string} Current layout name */
        this.currentLayoutName = "default";

        this._initializeLayouts();
    }

    /**
     * Initialize the service.
     * @private
     */
    _initializeLayouts() {
        if (this._$window.Modernizr && this._$window.Modernizr.localstorage) {
            try {
                const storedLayouts = JSON.parse(this._$window.localStorage.getItem(`layoutsNW-${this._$window.ContactID}`));
                const lastActiveLayoutName = this._$window.localStorage.getItem(`lastActiveLayoutNW-${this._$window.ContactID}`);

                // Initialize layouts with at least the default layout
                this.currentLayouts = storedLayouts || [this.defaultLayout[0]];

                // Ensure default layout is always first and up to date
                this.currentLayouts[0] = this.defaultLayout[0];

                // Try to load the last active layout
                if (lastActiveLayoutName) {
                    const lastActiveLayout = this.currentLayouts.find(l => l.name === lastActiveLayoutName);
                    if (lastActiveLayout) {
                        this.loadLayout(this.currentLayouts.indexOf(lastActiveLayout));
                    } else {
                        this.loadLayout(0);
                    }
                } else {
                    this.loadLayout(0);
                }
            } catch (error) {
                console.error('Error loading stored layouts:', error);
                this.currentLayouts = this.defaultLayout;
                this.loadLayout(0);
            }
        }
    }

    /**
     * Update the column1 layout based on the current showFlightTable value
     */
    updateColumn1Layout() {
        /** @type {Column} */
        this.column1 = {
            id: "col1",
            width: this.COL_WIDTH_LARGE,
            boxes: [
                this.jobsListBox,
                this.shouldDisplayFlightTable ? this.flightDataTableBox : this.agentDataTableBox
            ]
        };

        // Update the current layout
        if (this.currentLayouts && this.currentLayouts.length > 0) {
            this.currentLayouts[0].layout.columns[0] = this.column1;
            this.updateLayouts(this.currentLayouts);
        }
    }

    /**
     * Show the flight table
     */
    showFlightTable() {
        this.shouldDisplayFlightTable = true;
        this.updateColumn1Layout();
    }

    /**
     * Show the flight table
     */
    showAgentTable() {
        this.shouldDisplayFlightTable = false;
        this.updateColumn1Layout();
    }

    /**
     * Set the last active layout name.
     * @param {string} layoutName - The name of the layout to set as last active.
     */
    setLastActiveLayoutName(layoutName) {
        if (this._$window.Modernizr && this._$window.Modernizr.localstorage) {
            this._$window.localStorage.setItem(`lastActiveLayoutNW-${this._$window.ContactID}`, layoutName);
        }
    }

    /**
     * Get the default layout.
     * @returns {Layout[]} A copy of the default layout.
     */
    getDefaultLayout() {
        return angular.copy(this.defaultLayout);
    }

    /**
     * Get all current layouts.
     * @returns {Layout[]} A copy of all current layouts.
     */
    getLayouts() {
        return angular.copy(this.currentLayouts);
    }

    /**
     * Get the current active layout.
     * @returns {Object} A copy of the current active layout configuration.
     */
    getCurrentLayout() {
        return angular.copy(this.currentLayouts[0].layout);
    }

    /**
     * Get the current map zoom configuration.
     * @returns {Object} A copy of the current map zoom configuration.
     */
    getMapZoom() {
        return angular.copy(this.mapZoom);
    }

    /**
     * Set the map zoom configuration.
     * @param {Object} newMapZoom - The new map zoom configuration to set.
     */
    setMapZoom(newMapZoom) {
        this.mapZoom = newMapZoom;
        if (this._$window.Modernizr && this._$window.Modernizr.localstorage) {
            this._$window.localStorage.setItem(`mapZoomNW-${this._$window.ContactID}`, JSON.Stringify(this.mapZoom));
        }
    }

    /**
     * Get the user's first name.
     * @returns {string} The user's first name.
     */
    getUserName() {
        return this._$window.FirstName;
    }

    /**
     * Update the current layouts.
     * @param {Layout[]} newLayouts - The new layouts to set.
     */
    updateLayouts(newLayouts) {
        this.currentLayouts = newLayouts;
        if (this._$window.Modernizr && this._$window.Modernizr.localstorage) {
            this._$window.localStorage.setItem(`layoutsNW-${this._$window.ContactID}`, JSON.stringify(this.currentLayouts));
        }
        // Notify any listeners that the layout has changed
        if (this._$rootScope) {
            this._$rootScope.$broadcast('layoutUpdated');
        }
    }

    /**
     * Load a layout.
     * @param {number} index - The index of the layout to load.
     * @returns {Object} The loaded layout.
     */
    loadLayout(index) {
        if (!this.currentLayouts[index]) {
            console.warn('Invalid layout index, loading default');
            index = 0;
        }

        this.currentLayoutName = this.currentLayouts[index].name;
        this.currentLayout = angular.copy(this.currentLayouts[index].layout);

        // Save as last active layout
        if (this._$window.Modernizr && this._$window.Modernizr.localstorage) {
            this._$window.localStorage.setItem(`lastActiveLayoutNW-${this._$window.ContactID}`, this.currentLayoutName);
        }

        // Apply the layout dimensions
        this._applyLayoutDimensions(this.currentLayout);

        return this.currentLayout;
    }

    /**
     * Load a layout.
     * @param {Object} layout - The index of the layout to load.
     * @private
     */
    _applyLayoutDimensions(layout) {
        if (!layout || !layout.columns) return;

        layout.columns.forEach(column => {
            const columnElement = angular.element(`#co-${column.id}`);
            if (columnElement.length) {
                columnElement.css('flex-basis', column.width);

                column.boxes.forEach(box => {
                    const boxElement = angular.element(`#box-${box.name}`);
                    if (boxElement.length) {
                        boxElement.css('flex-basis', box.height);
                    }
                });
            }
        });
    }

    /**
     * Save a layout.
     * @param {Object} layout - The current layout to save.
     * @returns {Promise<Object>} A promise that resolves with the saved layout information.
     */
    async saveLayout(layout) {
        try {
            // Capture the current layout state
            const capturedLayout = {
                columns: layout.columns.map(column => ({
                    ...column,
                    width: angular.element(`#co-${column.id}`).css('flex-basis'),
                    boxes: column.boxes.map(box => ({
                        ...box,
                        height: angular.element(`#box-${box.name}`).css('flex-basis')
                    }))
                }))
            };

            const layoutName = await this._$mdDialog.show(this._$mdDialog.prompt()
                .title('Save Layout')
                .textContent('Please enter a name for this layout.')
                .ariaLabel('Layout name')
                .required(true)
                .ok('Save')
                .cancel('Cancel'));

            const newLayout = {
                name: layoutName,
                layout: capturedLayout
            };

            // Make sure we have currentLayouts
            if (!this.currentLayouts) {
                this.currentLayouts = [this.defaultLayout[0]];
            }

            this.currentLayouts.push(newLayout);
            this.currentLayoutName = layoutName;
            this.currentLayout = capturedLayout;

            if (this._$window.Modernizr && this._$window.Modernizr.localstorage) {
                this._$window.localStorage.setItem(`layoutsNW-${this._$window.ContactID}`, JSON.stringify(this.currentLayouts));
                this._$window.localStorage.setItem(`lastActiveLayoutNW-${this._$window.ContactID}`, layoutName);
            }

            this._$rootScope.$broadcast('layoutUpdated');
            return {name: layoutName, layout: capturedLayout};
        } catch (error) {
            if (error === undefined) {
                console.log("Save Layout Cancelled!");
            } else {
                console.error("Unable to save layout");
            }
        }
    }


    /**
     * Delete a layout.
     * @param {number} index - The index of the layout to delete.
     * @returns {Promise<void>}
     */
    async deleteLayout(index) {
        if (index === 0) return; // Prevent deleting default layout

        try {
            await this._$mdDialog.show(this._$mdDialog.confirm()
                .title('Delete Layout?')
                .textContent('Are you sure you would like to delete this layout?')
                .ok('Delete')
                .cancel('Cancel'));

            // Make sure we have currentLayouts
            if (!this.currentLayouts) {
                this.currentLayouts = [this.defaultLayout[0]];
            }

            this.currentLayouts.splice(index, 1);

            if (this._$window.Modernizr && this._$window.Modernizr.localstorage) {
                this._$window.localStorage.setItem(`layoutsNW-${this._$window.ContactID}`, JSON.stringify(this.currentLayouts));
            }

            // Load default if we deleted the current layout
            if (this.currentLayoutName === this.currentLayouts[index]?.name) {
                this.loadLayout(0);
            }

            this._$rootScope.$broadcast('layoutUpdated');
        } catch (error) {
            if (error === undefined) {
                console.log("Save Layout Cancelled!");
            } else {
                console.error("Unable to delete layout");
            }
        }
    }

    /**
     * Get the name of the current layout.
     * @returns {string} The name of the current layout.
     */
    getCurrentLayoutName() {
        return this.currentLayoutName;
    }
}

angular.module('uDispatch').service('NationwideLayoutService', ['$window', '$mdDialog', '$rootScope', ($window, $mdDialog, $rootScope) => new NationwideLayoutService($window, $mdDialog, $rootScope)]);
