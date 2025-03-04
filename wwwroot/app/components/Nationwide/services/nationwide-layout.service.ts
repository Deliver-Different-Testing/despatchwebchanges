import app from "../../../app";
import {Column, Layout} from "../../../interfaces/layout.interfaces";

class NationwideLayoutService implements angular.IServiceProvider {
    static $inject = ["$window", "$mdDialog", "$rootScope"];

    // Column width options
    readonly COL_WIDTH_LARGE: string = "35%";
    readonly COL_WIDTH_MEDIUM: string = "30%";

    // Box height options
    readonly BOX_HEIGHT_LARGE: string = "60%";
    readonly BOX_HEIGHT_MEDIUM: string = "50%";
    readonly BOX_HEIGHT_SMALL: string = "40%";
    readonly BOX_HEIGHT_XSMALL: string = "30%";

    // Define individual boxes
    jobsListBox: Box = {name: "jobsList", height: this.BOX_HEIGHT_LARGE};
    jobsListPODBox: Box = {name: "jobsListPOD", height: this.BOX_HEIGHT_SMALL};
    jobsListDeliveryBox: Box = {name: "jobsListDelivery", height: this.BOX_HEIGHT_MEDIUM};
    jobsListRepriceBox: Box = {name: "jobsListReprice", height: this.BOX_HEIGHT_MEDIUM};
    mapTableBox: Box = {name: "map", height: this.BOX_HEIGHT_XSMALL};
    jobDetailBox: Box = {name: "jobDetail", height: this.BOX_HEIGHT_LARGE};
    flightAgentDataTableBox: Box = {name: "flightAgentDataTable", height: this.BOX_HEIGHT_XSMALL};

    // Define columns
    column1: Column = {
        id: "col1",
        width: this.COL_WIDTH_LARGE,
        boxes: [this.jobsListBox, this.flightAgentDataTableBox]
    };

    column2: Column = {
        id: "col2",
        width: this.COL_WIDTH_LARGE,
        boxes: [this.jobDetailBox, this.mapTableBox]
    };

    column3: Column = {
        id: "col3",
        width: this.COL_WIDTH_MEDIUM,
        boxes: [this.jobsListPODBox, this.jobsListDeliveryBox, this.jobsListRepriceBox]
    };

    // Construct the layout
    defaultLayout: Layout[] = [
        {
            name: "Default",
            layout: {
                columns: [this.column1, this.column2, this.column3]
            }
        }
    ];

    currentLayouts: Layout[] | null = null;
    mapZoom: { display: boolean } = {display: true};
    currentLayoutName: string = "Default";
    currentLayoutIndex: number = 0;
    private currentLayout: any;

    constructor(
        private $window: angular.IWindowService,
        private $mdDialog: angular.material.IDialogService,
        private $rootScope: angular.IRootScopeService) {
        this._initializeLayouts();
    }

    $get(): any {
        return this;
    }

    getLayouts(): Layout[] | null {
        return angular.copy(this.currentLayouts);
    }

    getDefaultLayout(): Layout[] {
        return angular.copy(this.defaultLayout);
    }

    getCurrentLayoutIndex(): number {
        return this.currentLayoutIndex;
    }

    getCurrentLayoutName(): string {
        return this.currentLayoutName;
    }

    getCurrentLayout(): Object {
        return this.currentLayout
            ? angular.copy(this.currentLayout)
            : this.defaultLayout[0].layout;
    }

    setMapZoom(newMapZoom: { display: boolean }): void {
        this.mapZoom = newMapZoom;
        if (this.$window.Modernizr && this.$window.Modernizr.localstorage) {
            this.$window.localStorage.setItem(
                `mapZoomNW-${this.$window.ContactID}`,
                JSON.stringify(this.mapZoom)
            );
        }
    }

    getUserName(): string {
        return this.$window.FirstName;
    }

    private _initializeLayouts(): void {
        if (this.$window.Modernizr && this.$window.Modernizr.localstorage) {
            try {
                const storedLayouts: Layout[] = JSON.parse(
                    this.$window.localStorage.getItem(
                        `layoutsNW-${this.$window.ContactID}`
                    ) ?? '[]'
                ) || [this.defaultLayout[0]];
                const lastActiveLayoutName: string | null =
                    this.$window.localStorage.getItem(
                        `lastActiveLayoutNW-${this.$window.ContactID}`
                    );

                this.currentLayouts = storedLayouts;
                this.currentLayouts[0] = this.defaultLayout[0];

                let layoutIndex = 0;
                if (lastActiveLayoutName) {
                    const lastActiveLayoutIndex = this.currentLayouts.findIndex(
                        (l) => l.name === lastActiveLayoutName
                    );
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
            } catch (error) {
                console.error("Error loading stored layouts:", error);
                this.currentLayouts = [this.defaultLayout[0]];
                this.loadLayout(0);
            }
        }
    }

    async saveLayout(layout: any): Promise<{ name: string; layout: any } | void> {
        try {
            const capturedLayout = {
                columns: layout.columns.map((column: any) => ({
                    ...column,
                    width: angular
                        .element(`#co-${column.id}`)
                        .css("flex-basis"),
                    boxes: column.boxes.map((box: any) => ({
                        ...box,
                        height: angular
                            .element(`#box-${box.name}`)
                            .css("flex-basis")
                    }))
                }))
            };

            const layoutName: string = await this.$mdDialog.show(
                this.$mdDialog
                    .prompt()
                    .title("Save Layout")
                    .textContent("Please enter a name for this layout.")
                    .ariaLabel("Layout name")
                    .required(true)
                    .ok("Save")
                    .cancel("Cancel")
            );

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
                this.$window.localStorage.setItem(
                    `layoutsNW-${this.$window.ContactID}`,
                    JSON.stringify(this.currentLayouts)
                );
                this.$window.localStorage.setItem(
                    `lastActiveLayoutNW-${this.$window.ContactID}`,
                    layoutName
                );
            }

            this.$rootScope.$broadcast("layoutUpdated");
            return {name: layoutName, layout: capturedLayout};
        } catch (error) {
            if (error === undefined) {
                console.log("Save Layout Cancelled!");
            } else {
                console.error("Unable to save layout");
            }
        }
    }

    async deleteLayout(index: number): Promise<void> {
        if (index === 0) return;

        try {
            await this.$mdDialog.show(
                this.$mdDialog
                    .confirm()
                    .title("Delete Layout?")
                    .textContent(
                        "Are you sure you would like to delete this layout?"
                    )
                    .ok("Delete")
                    .cancel("Cancel")
            );

            if (!this.currentLayouts) {
                this.currentLayouts = [this.defaultLayout[0]];
            }

            this.currentLayouts.splice(index, 1);

            if (this.$window.Modernizr && this.$window.Modernizr.localstorage) {
                this.$window.localStorage.setItem(
                    `layoutsNW-${this.$window.ContactID}`,
                    JSON.stringify(this.currentLayouts)
                );
            }

            if (
                this.currentLayoutName ===
                this.currentLayouts[index]?.name
            ) {
                this.loadLayout(0);
            }

            this.$rootScope.$broadcast("layoutUpdated");
        } catch (error) {
            if (error === undefined) {
                console.log("Save Layout Cancelled!");
            } else {
                console.error("Unable to delete layout");
            }
        }
    }

    loadLayout(index: number) {
        if (!this.currentLayouts || !this.currentLayouts[index]) {
            console.warn("Invalid layout index, loading default");
            return null;
        }

        this.currentLayoutIndex = index;
        this.currentLayoutName = this.currentLayouts[index].name;
        this.currentLayout = angular.copy(this.currentLayouts[index].layout);

        if (this.$window.Modernizr && this.$window.Modernizr.localstorage) {
            this.$window.localStorage.setItem(
                `lastActiveLayoutNW-${this.$window.ContactID}`,
                this.currentLayoutName
            );
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

    private applyLayoutDimensions(layout: any): void {
        if (!layout || !layout.columns) return;

        layout.columns.forEach((column: any) => {
            const columnElement = angular.element(`#co-${column.id}`);
            if (columnElement.length) {
                columnElement.css("flex-basis", column.width);

                column.boxes.forEach((box: any) => {
                    const boxElement = angular.element(`#box-${box.name}`);
                    if (boxElement.length) {
                        boxElement.css("flex-basis", box.height);
                    }
                });
            }
        });
    }
}

app.service("NationwideLayoutService", NationwideLayoutService);
export default NationwideLayoutService;
