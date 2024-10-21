/**
 * @fileoverview Service for managing layout configurations on the CS page
 * @module CSLayoutService
 */
class CSLayoutService {
    /**
     * Create a CSLayoutService.
     * @param {Object} $window
     * @param {Object} $mdDialog
     */
    constructor($window, $mdDialog) {
        this._$window = $window;
        this._$mdDialog = $mdDialog;

        // Column width options
        /** @type {string} */
        this.COL_WIDTH_LARGE = "50%";
        /** @type {string} */
        this.COL_WIDTH_MEDIUM = "30%";
        /** @type {string} */
        this.COL_WIDTH_SMALL = "20%";

        // Box height options
        /** @type {string} */
        this.BOX_HEIGHT_XLARGE = "100%";
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
        this.searchBox = {name: "pickDate", height: this.BOX_HEIGHT_XLARGE};
        /** @type {Box} */
        this.jobListBox = {name: "jobList", height: this.BOX_HEIGHT_SMALL};
        /** @type {Box} */
        this.bulkJobListBox = {name: "bulkJobList", height: this.BOX_HEIGHT_MEDIUM};
        /** @type {Box} */
        this.pbListBox = {name: "pbList", height: this.BOX_HEIGHT_MEDIUM};
        /** @type {Box} */
        this.mapBox = {name: "map", height: this.BOX_HEIGHT_XSMALL};
        /** @type {Box} */
        this.jobDetailBox = {name: "jobDetail", height: this.BOX_HEIGHT_SMALL};
        /** @type {Box} */
        this.scanListBox = {name: "scanList", height: this.BOX_HEIGHT_XSMALL};

        // Define columns
        /** @type {Column} */
        this.column1 = {
            id: "col1",
            width: this.COL_WIDTH_SMALL,
            boxes: [
                this.searchBox,
            ]
        };

        /** @type {Column} */
        this.column2 = {
            id: "col2",
            width: this.COL_WIDTH_LARGE, boxes: [this.jobListBox, this.bulkJobListBox, this.pbListBox]
        };

        /** @type {Column} */
        this.column3 = {
            id: "col3",
            width: this.COL_WIDTH_MEDIUM,
            boxes: [this.jobDetailBox, this.scanListBox, this.mapBox]
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

        this.init();
    }

    /**
     * Initialize the service.
     */
    init() {
        if (this._$window.Modernizr && this._$window.Modernizr.localstorage) {
            const storedLayouts = this._$window.localStorage.getItem(`layoutsNW-${this._$window.ContactID}`);
            const storedMapZoom = this._$window.localStorage.getItem(`mapZoomCS-${this._$window.ContactID}`);

            if (storedLayouts) {
                try {
                    this.currentLayouts = JSON.parse(storedLayouts);
                    // Ensure currentLayouts is an array and has at least one item
                    if (!Array.isArray(this.currentLayouts) || this.currentLayouts.length === 0) {
                        throw new Error('Invalid stored layouts');
                    }
                    this.currentLayouts[0] = this.defaultLayout[0]; // Always use the latest default layout
                } catch (error) {
                    console.error('Error parsing stored layouts:', error);
                    this.currentLayouts = this.defaultLayout;
                }
            }

            if (storedMapZoom) {
                try {
                    this.mapZoom = JSON.parse(storedMapZoom);
                } catch (error) {
                    console.error('Error parsing stored map zoom:', error);
                    this.mapZoom = {display: true}; // Default value
                }
            }
        }

        if (!this.currentLayouts) {
            this.currentLayouts = this.defaultLayout;
        }
    }

    /**
     * Set the last active layout name.
     * @param {string} layoutName - The name of the layout to set as last active.
     */
    setLastActiveLayoutName(layoutName) {
        if (this._$window.Modernizr && this._$window.Modernizr.localstorage) {
            this._$window.localStorage.setItem(`lastActiveLayoutCS-${this._$window.ContactID}`, layoutName);
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
            this._$window.localStorage.setItem(`mapZoomCS-${this._$window.ContactID}`, JSON.Stringify(this.mapZoom));
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
     * Delete a layout.
     * @param {number} index - The index of the layout to delete.
     * @returns {Promise<void>}
     */
    async deleteLayout(index) {
        const deleteConfirm = this._$mdDialog.confirm()
            .title('Delete Layout?')
            .textContent('Are you sure you would like to delete this layout?')
            .ariaLabel('delete layout')
            .ok('Delete')
            .cancel('Cancel');

        try {
            await this._$mdDialog.show(deleteConfirm);

            this.layoutsObject.splice(index, 1);
            if (this._$window.Modernizr && this._$window.Modernizr.localstorage) {
                this._$window.localStorage.setItem(`layoutsCS-${this._$window.ContactID}`, JSON.Stringify(this.layoutsObject));
            }
        } catch (error) {
            console.log("Delete layout canceled!");
        }
    }

    /**
     * Load a layout.
     * @param {number} index - The index of the layout to load.
     * @returns {Object} The loaded layout.
     */
    loadLayout(index) {
        this.currentLayoutName = this.layoutsObject[index].name;
        const loadedLayout = angular.copy(this.layoutsObject[index].layout);

        this.setLastActiveLayoutName(this.currentLayoutName);

        return {
            name: this.currentLayoutName, layout: loadedLayout
        };
    }

    /**
     * Save a layout.
     * @param {Object} currentLayout - The current layout to save.
     * @returns {Promise<Object>} A promise that resolves with the saved layout information.
     */
    async saveLayout(currentLayout) {
        const saveLayoutPrompt = this._$mdDialog.prompt()
            .title('Save Layout')
            .textContent('Please enter a name for this layout.')
            .ariaLabel('Layout name')
            .required(true)
            .ok('Save')
            .cancel('Cancel');

        try {
            const layoutName = await this._$mdDialog.show(saveLayoutPrompt);

            if (this._$window.Modernizr && this._$window.Modernizr.localstorage) {
                this.layoutsObject = this.layoutsObject.concat({
                    name: layoutName, layout: angular.copy(currentLayout)
                });

                this._$window.localStorage.setItem(`layoutsCS-${this._$window.ContactID}`, JSON.Stringify(this.layoutsObject));

                this.setLastActiveLayoutName(layoutName);
            }

            return {data: "OK", name: layoutName};
        } catch (error) {
            console.log("Save Layout Cancelled!");
            throw error;
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

angular.module('uDispatch').service('CSLayoutService', ['$window', '$mdDialog', ($window, $mdDialog) => new CSLayoutService($window, $mdDialog)]);
