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
Object.defineProperty(exports, "__esModule", { value: true });
exports.NationwideLayoutService = void 0;
class NationwideLayoutService {
    constructor($window, $mdDialog, $rootScope) {
        this.$window = $window;
        this.$mdDialog = $mdDialog;
        this.$rootScope = $rootScope;
        // Column width options
        this.COL_WIDTH_LARGE = "35%";
        this.COL_WIDTH_MEDIUM = "30%";
        // Box height options
        this.BOX_HEIGHT_LARGE = "60%";
        this.BOX_HEIGHT_MEDIUM = "50%";
        this.BOX_HEIGHT_SMALL = "40%";
        this.BOX_HEIGHT_XSMALL = "30%";
        // Define individual boxes
        this.jobsListBox = { name: "jobsList", height: this.BOX_HEIGHT_LARGE };
        this.jobsListPODBox = { name: "jobsListPOD", height: this.BOX_HEIGHT_SMALL };
        this.jobsListDeliveryBox = { name: "jobsListDelivery", height: this.BOX_HEIGHT_MEDIUM };
        this.jobsListRepriceBox = { name: "jobsListReprice", height: this.BOX_HEIGHT_MEDIUM };
        this.mapTableBox = { name: "map", height: this.BOX_HEIGHT_XSMALL };
        this.jobDetailBox = { name: "jobDetail", height: this.BOX_HEIGHT_LARGE };
        this.flightAgentDataTableBox = { name: "flightAgentDataTable", height: this.BOX_HEIGHT_XSMALL };
        // Define columns
        this.column1 = {
            id: "col1",
            width: this.COL_WIDTH_LARGE,
            boxes: [this.jobsListBox, this.flightAgentDataTableBox]
        };
        this.column2 = {
            id: "col2",
            width: this.COL_WIDTH_LARGE,
            boxes: [this.jobDetailBox, this.mapTableBox]
        };
        this.column3 = {
            id: "col3",
            width: this.COL_WIDTH_MEDIUM,
            boxes: [this.jobsListPODBox, this.jobsListDeliveryBox, this.jobsListRepriceBox]
        };
        // Construct the layout
        this.defaultLayout = [
            {
                name: "Default",
                layout: {
                    columns: [this.column1, this.column2, this.column3]
                }
            }
        ];
        this.currentLayouts = null;
        this.mapZoom = { display: true };
        this.currentLayoutName = "Default";
        this.currentLayoutIndex = 0;
        this._initializeLayouts();
    }
    $get() {
        return this;
    }
    getLayouts() {
        return angular.copy(this.currentLayouts);
    }
    getDefaultLayout() {
        return angular.copy(this.defaultLayout);
    }
    getCurrentLayoutIndex() {
        return this.currentLayoutIndex;
    }
    getCurrentLayoutName() {
        return this.currentLayoutName;
    }
    getCurrentLayout() {
        return this.currentLayout
            ? angular.copy(this.currentLayout)
            : this.defaultLayout[0].layout;
    }
    setMapZoom(newMapZoom) {
        this.mapZoom = newMapZoom;
        if (this.$window.Modernizr && this.$window.Modernizr.localstorage) {
            this.$window.localStorage.setItem(`mapZoomNW-${this.$window.ContactID}`, JSON.stringify(this.mapZoom));
        }
    }
    getUserName() {
        return this.$window.FirstName;
    }
    _initializeLayouts() {
        var _a;
        if (this.$window.Modernizr && this.$window.Modernizr.localstorage) {
            try {
                const storedLayouts = JSON.parse((_a = this.$window.localStorage.getItem(`layoutsNW-${this.$window.ContactID}`)) !== null && _a !== void 0 ? _a : '[]') || [this.defaultLayout[0]];
                const lastActiveLayoutName = this.$window.localStorage.getItem(`lastActiveLayoutNW-${this.$window.ContactID}`);
                this.currentLayouts = storedLayouts;
                this.currentLayouts[0] = this.defaultLayout[0];
                let layoutIndex = 0;
                if (lastActiveLayoutName) {
                    const lastActiveLayoutIndex = this.currentLayouts.findIndex((l) => l.name === lastActiveLayoutName);
                    if (lastActiveLayoutIndex !== -1) {
                        layoutIndex = lastActiveLayoutIndex;
                    }
                }
                this.loadLayout(layoutIndex);
                if (this.$rootScope) {
                    this.$rootScope.$broadcast("layoutUpdated", {
                        currentLayoutIndex: layoutIndex,
                        currentLayoutName: this.currentLayoutName
                    });
                }
            }
            catch (error) {
                console.error("Error loading stored layouts:", error);
                this.currentLayouts = [this.defaultLayout[0]];
                this.loadLayout(0);
            }
        }
    }
    saveLayout(layout) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const capturedLayout = {
                    columns: layout.columns.map((column) => (Object.assign(Object.assign({}, column), { width: angular
                            .element(`#co-${column.id}`)
                            .css("flex-basis"), boxes: column.boxes.map((box) => (Object.assign(Object.assign({}, box), { height: angular
                                .element(`#box-${box.name}`)
                                .css("flex-basis") }))) })))
                };
                const layoutName = yield this.$mdDialog.show(this.$mdDialog
                    .prompt()
                    .title("Save Layout")
                    .textContent("Please enter a name for this layout.")
                    .ariaLabel("Layout name")
                    .required(true)
                    .ok("Save")
                    .cancel("Cancel"));
                const newLayout = {
                    name: layoutName,
                    layout: capturedLayout
                };
                if (!this.currentLayouts) {
                    this.currentLayouts = [this.defaultLayout[0]];
                }
                this.currentLayouts.push(newLayout);
                this.currentLayoutName = layoutName;
                this.currentLayout = capturedLayout;
                if (this.$window.Modernizr && this.$window.Modernizr.localstorage) {
                    this.$window.localStorage.setItem(`layoutsNW-${this.$window.ContactID}`, JSON.stringify(this.currentLayouts));
                    this.$window.localStorage.setItem(`lastActiveLayoutNW-${this.$window.ContactID}`, layoutName);
                }
                this.$rootScope.$broadcast("layoutUpdated");
                return { name: layoutName, layout: capturedLayout };
            }
            catch (error) {
                if (error === undefined) {
                    console.log("Save Layout Cancelled!");
                }
                else {
                    console.error("Unable to save layout");
                }
            }
        });
    }
    deleteLayout(index) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            if (index === 0)
                return;
            try {
                yield this.$mdDialog.show(this.$mdDialog
                    .confirm()
                    .title("Delete Layout?")
                    .textContent("Are you sure you would like to delete this layout?")
                    .ok("Delete")
                    .cancel("Cancel"));
                if (!this.currentLayouts) {
                    this.currentLayouts = [this.defaultLayout[0]];
                }
                this.currentLayouts.splice(index, 1);
                if (this.$window.Modernizr && this.$window.Modernizr.localstorage) {
                    this.$window.localStorage.setItem(`layoutsNW-${this.$window.ContactID}`, JSON.stringify(this.currentLayouts));
                }
                if (this.currentLayoutName ===
                    ((_a = this.currentLayouts[index]) === null || _a === void 0 ? void 0 : _a.name)) {
                    this.loadLayout(0);
                }
                this.$rootScope.$broadcast("layoutUpdated");
            }
            catch (error) {
                if (error === undefined) {
                    console.log("Save Layout Cancelled!");
                }
                else {
                    console.error("Unable to delete layout");
                }
            }
        });
    }
    loadLayout(index) {
        if (!this.currentLayouts || !this.currentLayouts[index]) {
            console.warn("Invalid layout index, loading default");
            return null;
        }
        this.currentLayoutIndex = index;
        this.currentLayoutName = this.currentLayouts[index].name;
        this.currentLayout = angular.copy(this.currentLayouts[index].layout);
        if (this.$window.Modernizr && this.$window.Modernizr.localstorage) {
            this.$window.localStorage.setItem(`lastActiveLayoutNW-${this.$window.ContactID}`, this.currentLayoutName);
        }
        this.applyLayoutDimensions(this.currentLayout);
        if (this.$rootScope) {
            this.$rootScope.$broadcast("layoutUpdated", {
                currentLayoutIndex: index,
                currentLayoutName: this.currentLayoutName
            });
        }
        return this.currentLayout;
    }
    applyLayoutDimensions(layout) {
        if (!layout || !layout.columns)
            return;
        layout.columns.forEach((column) => {
            const columnElement = angular.element(`#co-${column.id}`);
            if (columnElement.length) {
                columnElement.css("flex-basis", column.width);
                column.boxes.forEach((box) => {
                    const boxElement = angular.element(`#box-${box.name}`);
                    if (boxElement.length) {
                        boxElement.css("flex-basis", box.height);
                    }
                });
            }
        });
    }
}
exports.NationwideLayoutService = NationwideLayoutService;
NationwideLayoutService.$inject = ["$window", "$mdDialog", "$rootScope"];
