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
        this.mapTableBox = {name: "map", height: this.BOX_HEIGHT_XSMALL};
        /** @type {Box} */
        this.jobDetailBox = {name: "jobDetail", height: this.BOX_HEIGHT_LARGE};
        /** @type {Box} */
        this.flightAgentDataTableBox = {name: "flightAgentDataTable", height: this.BOX_HEIGHT_XSMALL};

        // Define columns
        this.column1 = {
            id: "col1",
            width: this.COL_WIDTH_LARGE,
            boxes: [
                this.jobsListBox,
                this.flightAgentDataTableBox
            ]
        };

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
        /** @type {Object} Map zoom configuration */
        this.mapZoom = {display: true};
        /** @type {string} Current layout name */
        this.currentLayoutName = "Default";
        /** @type {number} Current layout index */
        this.currentLayoutIndex = 0;

        this._initializeLayouts();
    }

    /**
     * Get all current layouts.
     * @returns {Layout[]} A copy of all current layouts.
     */
    getLayouts() {
        return angular.copy(this.currentLayouts);
    }

    /**
     * Get the default layout.
     * @returns {Layout[]} A copy of the default layout.
     */
    getDefaultLayout() {
        return angular.copy(this.defaultLayout);
    }

    /**
     * Get the current layout index.
     * @returns {number} The index of the current layout.
     */
    getCurrentLayoutIndex() {
        return this.currentLayoutIndex;
    }

    /**
     * Get the current layout name.
     * @returns {string} The name of the current layout.
     */
    getCurrentLayoutName() {
        return this.currentLayoutName;
    }

    /**
     * Get the current active layout.
     * @returns {Object} A copy of the current active layout configuration.
     */
    getCurrentLayout() {
        return this.currentLayout ? angular.copy(this.currentLayout) : this.defaultLayout[0].layout;
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
     * Initialize the service.
     * @private
     */
    _initializeLayouts() {
        if (this._$window.Modernizr && this._$window.Modernizr.localstorage) {
            try {
                // Load stored layouts
                const storedLayouts = JSON.parse(this._$window.localStorage.getItem(`layoutsNW-${this._$window.ContactID}`)) || [this.defaultLayout[0]];
                const lastActiveLayoutName = this._$window.localStorage.getItem(`lastActiveLayoutNW-${this._$window.ContactID}`);

                // Ensure default layout is always first and up to date
                this.currentLayouts = storedLayouts;
                this.currentLayouts[0] = this.defaultLayout[0];

                // Find the index of the last active layout
                let layoutIndex = 0;
                if (lastActiveLayoutName) {
                    const lastActiveLayoutIndex = this.currentLayouts.findIndex(l => l.name === lastActiveLayoutName);
                    if (lastActiveLayoutIndex !== -1) {
                        layoutIndex = lastActiveLayoutIndex;
                    }
                }

                // Load the appropriate layout
                this.loadLayout(layoutIndex);

                // Broadcast layout update with current index
                if (this._$rootScope) {
                    this._$rootScope.$broadcast('layoutUpdated', {
                        currentLayoutIndex: layoutIndex,
                        currentLayoutName: this.currentLayoutName
                    });
                }
            } catch (error) {
                console.error('Error loading stored layouts:', error);
                this.currentLayouts = [this.defaultLayout[0]];
                this.loadLayout(0);
            }
        }
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
     * Load a layout.
     * @param {number} index - The index of the layout to load.
     * @returns {Object} The loaded layout.
     */
    loadLayout(index) {
        if (!this.currentLayouts[index]) {
            console.warn('Invalid layout index, loading default');
            index = 0;
        }

        this.currentLayoutIndex = index;
        this.currentLayoutName = this.currentLayouts[index].name;
        this.currentLayout = angular.copy(this.currentLayouts[index].layout);

        // Save as last active layout
        if (this._$window.Modernizr && this._$window.Modernizr.localstorage) {
            this._$window.localStorage.setItem(`lastActiveLayoutNW-${this._$window.ContactID}`, this.currentLayoutName);
        }

        // Apply the layout dimensions
        this._applyLayoutDimensions(this.currentLayout);

        // Broadcast layout update
        if (this._$rootScope) {
            this._$rootScope.$broadcast('layoutUpdated', {
                currentLayoutIndex: index,
                currentLayoutName: this.currentLayoutName
            });
        }

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
}

angular.module('uDispatch').service('NationwideLayoutService', ['$window', '$mdDialog', '$rootScope', ($window, $mdDialog, $rootScope) => new NationwideLayoutService($window, $mdDialog, $rootScope)]);
