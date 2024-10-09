/**
 * @fileoverview Service for managing layout configurations in the uDispatch application.
 * @module NationwideLayoutService
 */
class NationwideLayoutService {
    /**
     * Create a NationwideLayoutService.
     * @param {Object} $window
     * @param {Object} $mdDialog
     */
    constructor($window, $mdDialog) {
        this._$window = $window;
        this._$mdDialog = $mdDialog;

        // Column width options
        /** @type {String} */
        this.COL_WIDTH_LARGE = "35%";
        /** @type {String} */
        this.COL_WIDTH_MEDIUM = "30%";

        // Box height options
        /** @type {String} */
        this.BOX_HEIGHT_LARGE = "60%";
        /** @type {String} */
        this.BOX_HEIGHT_MEDIUM = "50%";
        /** @type {String} */
        this.BOX_HEIGHT_SMALL = "40%";
        /** @type {String} */
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

        // Define columns
        /** @type {Column} */
        this.column1 = {
            id: "col1", width: this.COL_WIDTH_LARGE, boxes: [this.jobsListBox, this.flightDataTableBox]
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
        /** @type {Layout[]|null} Layouts object */
        this.layoutsObject = null;
        /** @type {Object} Map zoom configuration */
        this.mapZoom = {display: true};
        /** @type {String} Current layout name */
        this.currentLayoutName = "default";

        this.init();
    }

    /**
     * Initialize the service.
     */
    init() {
        if (this._$window.Modernizr && this._$window.Modernizr.localstorage) {
            const storedLayouts = this._$window.localStorage.getItem(`layoutsNW-${this._$window.ContactID}`);
            const storedMapZoom = this._$window.localStorage.getItem(`mapZoomNW-${this._$window.ContactID}`);

            if (storedLayouts) {
                this.currentLayouts = JSON.parse(storedLayouts);
                this.currentLayouts[0] = this.defaultLayout[0]; // Always use the latest default layout
            }

            if (storedMapZoom) {
                this.mapZoom = JSON.parse(storedMapZoom);
            }
        }

        if (!this.currentLayouts) {
            this.currentLayouts = this.defaultLayout;
        }
    }

    /**
     * Set the last active layout name.
     * @param {String} layoutName - The name of the layout to set as last active.
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
     * @returns {String} The user's first name.
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
            this._$window.localStorage.setItem(`layoutsNW-${this._$window.ContactID}`, JSON.Stringify(this.currentLayouts));
        }
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
                this._$window.localStorage.setItem(`layoutsNW-${this._$window.ContactID}`, JSON.Stringify(this.layoutsObject));
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

                this._$window.localStorage.setItem(`layoutsNW-${this._$window.ContactID}`, JSON.Stringify(this.layoutsObject));

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
     * @returns {String} The name of the current layout.
     */
    getCurrentLayoutName() {
        return this.currentLayoutName;
    }
}

angular.module('uDispatch').service('NationwideLayoutService', ['$window', '$mdDialog', ($window, $mdDialog) => new NationwideLayoutService($window, $mdDialog)]);
