import app from "../../../app";
import {Box, Column, Layout} from "../../../interfaces/layout.interfaces";

class CSLayoutService implements angular.IServiceProvider {
    static $inject = ['$window', '$mdDialog'];

    // Reused layout variables
    private readonly LAYOUTS_KEY_PREFIX = 'layoutsNW-';
    private MAP_ZOOM_KEY_PREFIX  = 'mapZoomCS-';
    private readonly DEFAULT_MAP_ZOOM = {display: true};

    // Column width options
    readonly COL_WIDTH_LARGE: string = "50%";
    readonly COL_WIDTH_MEDIUM: string = "30%";
    readonly COL_WIDTH_SMALL: string = "20%";

    // Box height options
    readonly BOX_HEIGHT_XLARGE: string = "100%";
    readonly BOX_HEIGHT_LARGE: string = "60%";
    readonly BOX_HEIGHT_MEDIUM: string = "50%";
    readonly BOX_HEIGHT_SMALL: string = "40%";
    readonly BOX_HEIGHT_XSMALL: string = "30%";

    // Define individual boxes
    private searchBox: Box = {name: "pickDate", height: this.BOX_HEIGHT_XLARGE};
    private jobListBox: Box = {name: "jobList", height: this.BOX_HEIGHT_SMALL};
    private bulkJobListBox: Box = {name: "bulkJobList", height: this.BOX_HEIGHT_MEDIUM};
    private pbListBox: Box = {name: "pbList", height: this.BOX_HEIGHT_MEDIUM};
    private mapBox: Box = {name: "map", height: this.BOX_HEIGHT_XSMALL};
    private jobDetailBox: Box = {name: "jobDetail", height: this.BOX_HEIGHT_SMALL};
    private scanListBox: Box = {name: "scanList", height: this.BOX_HEIGHT_XSMALL};

    // Define columns
    private column1: Column = {
        id: "col1",
        width: this.COL_WIDTH_SMALL,
        boxes: [this.searchBox],
    };

    private column2: Column = {
        id: "col2",
        width: this.COL_WIDTH_LARGE,
        boxes: [this.jobListBox, this.bulkJobListBox, this.pbListBox],
    };

    private column3: Column = {
        id: "col3",
        width: this.COL_WIDTH_MEDIUM,
        boxes: [this.jobDetailBox, this.scanListBox, this.mapBox],
    };

    // Construct the layout
    private defaultLayout: Layout[] = [{
        name: "Default",
        layout: {
            columns: [this.column1, this.column2, this.column3],
        },
    }];

    private currentLayouts: Layout[] | null = null;
    private layoutsObject: Layout[] | null = null;
    private mapZoom: { display: boolean } = {display: true};
    private currentLayoutName: string = "default";

    constructor(private $window: angular.IWindowService,
                private $mdDialog: angular.material.IDialogService) {
        this.initialize();
    }

    private initialize(): void {
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

    private isLocalStorageAvailable(): boolean {
        return !!(this.$window.Modernizr && this.$window.Modernizr.localstorage);
    }

    private initializeLayouts(): void {
        const storageKey = `${this.LAYOUTS_KEY_PREFIX}${this.$window.ContactID}`;
        const storedLayouts = this.$window.localStorage.getItem(storageKey);

        if (!storedLayouts) {
            return;
        }

        try {
            this.currentLayouts = JSON.parse(storedLayouts) as Layout[];
            if (!Array.isArray(this.currentLayouts) || this.currentLayouts.length === 0) {
                throw Error('Invalid stored layouts');
            }
            this.currentLayouts[0] = this.defaultLayout[0];
        } catch (error) {
            console.error('Error parsing stored layouts:', error);
            this.setDefaultLayouts();
        }
    }

    private initializeMapZoom(): void {
        const storageKey = `${this.MAP_ZOOM_KEY_PREFIX}${this.$window.ContactID}`;
        const storedMapZoom = this.$window.localStorage.getItem(storageKey);

        if (!storedMapZoom) {
            return;
        }

        try {
            this.mapZoom = JSON.parse(storedMapZoom);
        } catch (error) {
            console.error('Error parsing stored map zoom:', error);
            this.mapZoom = this.DEFAULT_MAP_ZOOM;
        }
    }

    private setDefaultLayouts(): void {
        this.currentLayouts = this.defaultLayout;
    }

    public setLastActiveLayoutName(layoutName: string): void {
        if (this.$window.Modernizr && this.$window.Modernizr.localstorage) {
            this.$window.localStorage.setItem(`lastActiveLayoutCS-${this.$window.ContactID}`, layoutName);
        }
    }

    getDefaultLayout(): Layout[] {
        return angular.copy(this.defaultLayout);
    }

    public getLayouts(): Layout[] {
        if (this.currentLayouts === null) return new Array<Layout>();
        return angular.copy(this.currentLayouts);
    }

    getCurrentLayout(): object {
        return angular.copy(this.currentLayouts![0].layout);
    }

    getMapZoom(): { display: boolean } {
        return angular.copy(this.mapZoom);
    }

    public setMapZoom(newMapZoom: { display: boolean }): void {
        this.mapZoom = newMapZoom;
        if (this.$window.Modernizr && this.$window.Modernizr.localstorage) {
            this.$window.localStorage.setItem(`mapZoomCS-${this.$window.ContactID}`, JSON.stringify(this.mapZoom));
        }
    }

    public getUserName(): string {
        return this.$window.FirstName;
    }

    public async deleteLayout(index: number): Promise<void> {
        const deleteConfirm = this.$mdDialog.confirm()
            .title('Delete Layout?')
            .textContent('Are you sure you would like to delete this layout?')
            .ariaLabel('delete layout')
            .ok('Delete')
            .cancel('Cancel');

        try {
            await this.$mdDialog.show(deleteConfirm);
            this.layoutsObject!.splice(index, 1);

            if (this.$window.Modernizr && this.$window.Modernizr.localstorage) {
                this.$window.localStorage.setItem(`layoutsCS-${this.$window.ContactID}`, JSON.stringify(this.layoutsObject));
            }
        } catch (error) {
            console.log("Delete layout canceled!");
        }
    }

    public loadLayout(index: number): { name: string; layout: object } {
        this.currentLayoutName = this.layoutsObject![index].name;
        const loadedLayout = angular.copy(this.layoutsObject![index].layout);

        this.setLastActiveLayoutName(this.currentLayoutName);

        return {
            name: this.currentLayoutName,
            layout: loadedLayout,
        };
    }

    public async saveLayout(currentLayout: object): Promise<{ data: string; name: string }> {
        const saveLayoutPrompt = this.$mdDialog.prompt()
            .title('Save Layout')
            .textContent('Please enter a name for this layout.')
            .ariaLabel('Layout name')
            .required(true)
            .ok('Save')
            .cancel('Cancel');

        try {
            const layoutName: string = await this.$mdDialog.show(saveLayoutPrompt);

            if (this.$window.Modernizr && this.$window.Modernizr.localstorage) {
                this.layoutsObject = this.layoutsObject!.concat({
                    name: layoutName,
                    layout: {
                        columns: (angular.copy(currentLayout) as { columns: Column[] }).columns
                    },
                });

                this.$window.localStorage.setItem(`layoutsCS-${this.$window.ContactID}`, JSON.stringify(this.layoutsObject));

                this.setLastActiveLayoutName(layoutName);
            }

            return {data: "OK", name: layoutName};
        } catch (error) {
            console.log("Save Layout Cancelled!");
            throw error;
        }
    }

    public getCurrentLayoutName(): string {
        return this.currentLayoutName;
    }

    $get(): any {
        return this;
    }
}

app.service('CSLayoutService', CSLayoutService);
