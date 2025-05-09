"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("../../../app"));
class CSLayoutService {
    constructor($window, $mdDialog) {
        this.$window = $window;
        this.$mdDialog = $mdDialog;
        // Reused layout variables
        this.LAYOUTS_KEY_PREFIX = 'layoutsNW-';
        this.MAP_ZOOM_KEY_PREFIX = 'mapZoomCS-';
        this.DEFAULT_MAP_ZOOM = { display: true };
        // Column width options
        this.COL_WIDTH_LARGE = "50%";
        this.COL_WIDTH_MEDIUM = "30%";
        this.COL_WIDTH_SMALL = "20%";
        // Box height options
        this.BOX_HEIGHT_XLARGE = "100%";
        this.BOX_HEIGHT_LARGE = "60%";
        this.BOX_HEIGHT_MEDIUM = "50%";
        this.BOX_HEIGHT_SMALL = "40%";
        this.BOX_HEIGHT_XSMALL = "30%";
        // Define individual boxes
        this.searchBox = { name: "pickDate", height: this.BOX_HEIGHT_XLARGE };
        this.jobListBox = { name: "jobList", height: this.BOX_HEIGHT_SMALL };
        this.bulkJobListBox = { name: "bulkJobList", height: this.BOX_HEIGHT_MEDIUM };
        this.pbListBox = { name: "pbList", height: this.BOX_HEIGHT_MEDIUM };
        this.mapBox = { name: "map", height: this.BOX_HEIGHT_XSMALL };
        this.jobDetailBox = { name: "jobDetail", height: this.BOX_HEIGHT_SMALL };
        this.scanListBox = { name: "scanList", height: this.BOX_HEIGHT_XSMALL };
        // Define columns
        this.column1 = {
            id: "col1",
            width: this.COL_WIDTH_SMALL,
            boxes: [this.searchBox],
        };
        this.column2 = {
            id: "col2",
            width: this.COL_WIDTH_LARGE,
            boxes: [this.jobListBox, this.bulkJobListBox, this.pbListBox],
        };
        this.column3 = {
            id: "col3",
            width: this.COL_WIDTH_MEDIUM,
            boxes: [this.jobDetailBox, this.scanListBox, this.mapBox],
        };
        // Construct the layout
        this.defaultLayout = [{
                name: "Default",
                layout: {
                    columns: [this.column1, this.column2, this.column3],
                },
            }];
        this.currentLayouts = null;
        this.layoutsObject = null;
        this.mapZoom = { display: true };
        this.currentLayoutName = "default";
        this.initialize();
    }
    initialize() {
        if (!this.isLocalStorageAvailable()) {
            this.setDefaultLayouts();
            return;
        }
        this.initializeLayouts();
        this.initializeMapZoom();
        if (!this.currentLayouts) {
            this.setDefaultLayouts();
        }
    }
    isLocalStorageAvailable() {
        return !!(this.$window.Modernizr && this.$window.Modernizr.localstorage);
    }
    initializeLayouts() {
        const storageKey = `${this.LAYOUTS_KEY_PREFIX}${this.$window.ContactID}`;
        const storedLayouts = this.$window.localStorage.getItem(storageKey);
        if (!storedLayouts) {
            return;
        }
        try {
            this.currentLayouts = JSON.parse(storedLayouts);
            if (!Array.isArray(this.currentLayouts) || this.currentLayouts.length === 0) {
                throw Error('Invalid stored layouts');
            }
            this.currentLayouts[0] = this.defaultLayout[0];
        }
        catch (error) {
            console.error('Error parsing stored layouts:', error);
            this.setDefaultLayouts();
        }
    }
    initializeMapZoom() {
        const storageKey = `${this.MAP_ZOOM_KEY_PREFIX}${this.$window.ContactID}`;
        const storedMapZoom = this.$window.localStorage.getItem(storageKey);
        if (!storedMapZoom) {
            return;
        }
        try {
            this.mapZoom = JSON.parse(storedMapZoom);
        }
        catch (error) {
            console.error('Error parsing stored map zoom:', error);
            this.mapZoom = this.DEFAULT_MAP_ZOOM;
        }
    }
    setDefaultLayouts() {
        this.currentLayouts = this.defaultLayout;
    }
    setLastActiveLayoutName(layoutName) {
        if (this.$window.Modernizr && this.$window.Modernizr.localstorage) {
            this.$window.localStorage.setItem(`lastActiveLayoutCS-${this.$window.ContactID}`, layoutName);
        }
    }
    getDefaultLayout() {
        return angular.copy(this.defaultLayout);
    }
    getLayouts() {
        if (this.currentLayouts === null)
            return new Array();
        return angular.copy(this.currentLayouts);
    }
    getCurrentLayout() {
        return angular.copy(this.currentLayouts[0].layout);
    }
    getMapZoom() {
        return angular.copy(this.mapZoom);
    }
    setMapZoom(newMapZoom) {
        this.mapZoom = newMapZoom;
        if (this.$window.Modernizr && this.$window.Modernizr.localstorage) {
            this.$window.localStorage.setItem(`mapZoomCS-${this.$window.ContactID}`, JSON.stringify(this.mapZoom));
        }
    }
    getUserName() {
        return this.$window.FirstName;
    }
    deleteLayout(index) {
        return __awaiter(this, void 0, void 0, function* () {
            const deleteConfirm = this.$mdDialog.confirm()
                .title('Delete Layout?')
                .textContent('Are you sure you would like to delete this layout?')
                .ariaLabel('delete layout')
                .ok('Delete')
                .cancel('Cancel');
            try {
                yield this.$mdDialog.show(deleteConfirm);
                this.layoutsObject.splice(index, 1);
                if (this.$window.Modernizr && this.$window.Modernizr.localstorage) {
                    this.$window.localStorage.setItem(`layoutsCS-${this.$window.ContactID}`, JSON.stringify(this.layoutsObject));
                }
            }
            catch (error) {
                console.log("Delete layout canceled!");
            }
        });
    }
    loadLayout(index) {
        this.currentLayoutName = this.layoutsObject[index].name;
        const loadedLayout = angular.copy(this.layoutsObject[index].layout);
        this.setLastActiveLayoutName(this.currentLayoutName);
        return {
            name: this.currentLayoutName,
            layout: loadedLayout,
        };
    }
    saveLayout(currentLayout) {
        return __awaiter(this, void 0, void 0, function* () {
            const saveLayoutPrompt = this.$mdDialog.prompt()
                .title('Save Layout')
                .textContent('Please enter a name for this layout.')
                .ariaLabel('Layout name')
                .required(true)
                .ok('Save')
                .cancel('Cancel');
            try {
                const layoutName = yield this.$mdDialog.show(saveLayoutPrompt);
                if (this.$window.Modernizr && this.$window.Modernizr.localstorage) {
                    this.layoutsObject = this.layoutsObject.concat({
                        name: layoutName,
                        layout: {
                            columns: angular.copy(currentLayout).columns
                        },
                    });
                    this.$window.localStorage.setItem(`layoutsCS-${this.$window.ContactID}`, JSON.stringify(this.layoutsObject));
                    this.setLastActiveLayoutName(layoutName);
                }
                return { data: "OK", name: layoutName };
            }
            catch (error) {
                console.log("Save Layout Cancelled!");
                throw error;
            }
        });
    }
    getCurrentLayoutName() {
        return this.currentLayoutName;
    }
    $get() {
        return this;
    }
}
CSLayoutService.$inject = ['$window', '$mdDialog'];
app_1.default.service('CSLayoutService', CSLayoutService);
