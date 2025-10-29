import {IGridsterItem, IBox, IGridsterLayout} from "../interfaces/layout.interfaces";
import GRIDSTER_BASE_CONFIG from "../gridster.config";
import isDefaultLayout from "../functions/isDefaultLayout";
import {AppPage} from "../enums/app-pages.enum";

class GridsterLayoutService implements angular.IServiceProvider {
    constructor() {
        console.log('GridsterLayoutService: Service instantiated');
    }

    $get(): this {
        return this;
    }
    
    getLayoutStorageKey(appPage: AppPage): string {
        return `gridsterLayouts-${appPage}-${ContactID}`;
    }

    getLastActiveLayoutKey(appPage: AppPage): string {
        return `gridsterLastActiveLayout-${appPage}-${ContactID}`;
    }

    loadLayoutsFromStorage(appPage: AppPage): IGridsterLayout[] {
        if (!Modernizr.localstorage) return [];

        try {
            const savedLayouts = localStorage.getItem(this.getLayoutStorageKey(appPage));
            if (savedLayouts) {
                return JSON.parse(savedLayouts).filter((l: IGridsterLayout) => l.name !== 'Default');
            }
        } catch (error) {
            console.error('Error loading gridster layouts:', error);
        }

        return [];
    }

    saveLayoutsToStorage(appPage: AppPage, layouts: IGridsterLayout[]): void {
        if (!Modernizr.localstorage) return;

        try {
            // Filter out Default layout before saving
            const layoutsToSave = layouts.filter(l => l.name !== 'Default');
            localStorage.setItem(this.getLayoutStorageKey(appPage), JSON.stringify(layoutsToSave));
        } catch (error) {
            console.error('Error saving gridster layouts:', error);
        }
    }

    getLastActiveLayoutName(appPage: AppPage): string | null {
        if (!Modernizr.localstorage) return null;

        try {
            return localStorage.getItem(this.getLastActiveLayoutKey(appPage));
        } catch (error) {
            console.error('Error loading last active layout:', error);
            return null;
        }
    }

    setLastActiveLayoutName(layoutName: string, appPage: AppPage): void {
        if (!Modernizr.localstorage) return;

        try {
            localStorage.setItem(this.getLastActiveLayoutKey(appPage), layoutName);
        } catch (error) {
            console.error('Error saving last active layout:', error);
        }
    }

    createGridsterConfig(
        currentLayoutName: string | undefined,
        onUpdate: () => void,
        $scope?: angular.IScope
    ): angular.gridster.GridsterConfig {
        return {
            ...GRIDSTER_BASE_CONFIG,
            resizable: {
                enabled: !isDefaultLayout(currentLayoutName),
                handles: ['n', 'e', 's', 'w', 'ne', 'se', 'sw', 'nw'],
                start: (event: angular.IAngularEvent, $element: angular.IAugmentedJQuery, options: any) => {
                    $scope?.$apply();
                },
                resize: (event: angular.IAngularEvent, $element: angular.IAugmentedJQuery, options: any) => {
                    $scope?.$apply();
                },
                stop: (event: angular.IAngularEvent, $element: angular.IAugmentedJQuery, options: any) => {
                    onUpdate();
                    $scope?.$apply();
                }
            },
            draggable: {
                enabled: !isDefaultLayout(currentLayoutName),
                handle: '.gridster-item-handle',
                start: (event: angular.IAngularEvent, $element: angular.IAugmentedJQuery, options: any) => {
                    $scope?.$apply();
                },
                drag: (event: angular.IAngularEvent, $element: angular.IAugmentedJQuery, options: any) => {
                    $scope?.$apply();
                },
                stop: (event: angular.IAngularEvent, $element: angular.IAugmentedJQuery, options: any) => {
                    onUpdate();
                    $scope?.$apply();
                }
            }
        };
    }

    loadLayout(
        layouts: IGridsterLayout[],
        index: number,
        appPage: AppPage,
        onLayoutChanged: (layoutName: string, items: IGridsterItem[]) => void
    ): boolean {
        if (index < 0 || index >= layouts.length) {
            console.error('Invalid layout index:', index);
            return false;
        }

        const layout = layouts[index];
        const items = JSON.parse(JSON.stringify(layout.items)); // Deep copy

        this.setLastActiveLayoutName(layout.name, appPage);
        onLayoutChanged(layout.name, items);
        return true;
    }

    updateLayout(
        appPage: AppPage,
        layouts: IGridsterLayout[],
        currentLayoutName: string | undefined,
        gridsterItems: IGridsterItem[],
    ): { success: boolean; message: string } {
        if (currentLayoutName === 'Default') {
            return {success: false, message: 'Cannot update the Default layout'};
        }

        if (!currentLayoutName) {
            return {success: false, message: 'No layout currently loaded to update'};
        }

        // Validate items
        gridsterItems.forEach((item: IGridsterItem, index: number) => {
            if (item.row === undefined || item.col === undefined) {
                console.error(`Item ${index} missing position data:`, item);
            }
        });

        const existingIndex = layouts.findIndex(l => l.name === currentLayoutName);

        if (existingIndex < 0) {
            return {success: false, message: `Layout "${currentLayoutName}" not found`};
        }

        layouts[existingIndex] = {
            name: currentLayoutName,
            items: JSON.parse(JSON.stringify(gridsterItems))
        };

        this.saveLayoutsToStorage(appPage, layouts);

        return {success: true, message: `Layout "${currentLayoutName}" updated`};
    }

    saveNewLayout(
        layouts: IGridsterLayout[],
        layoutName: string,
        gridsterItems: IGridsterItem[],
        appPage: AppPage,
    ): { success: boolean; message: string; isNewLayout: boolean } {
        if (!layoutName || layoutName.trim() === '') {
            return {success: false, message: 'Layout name cannot be empty', isNewLayout: false};
        }

        const trimmedName = layoutName.trim();
        const existingIndex = layouts.findIndex(l => l.name === trimmedName);

        const newLayout: IGridsterLayout = {
            name: trimmedName,
            items: JSON.parse(JSON.stringify(gridsterItems))
        };

        if (existingIndex >= 0) {
            layouts[existingIndex] = newLayout;
            this.saveLayoutsToStorage(appPage, layouts);
            this.setLastActiveLayoutName(trimmedName, appPage);
            return {
                success: true,
                message: `Layout "${trimmedName}" updated`,
                isNewLayout: false
            };
        } else {
            layouts.push(newLayout);
            this.saveLayoutsToStorage(appPage, layouts);
            this.setLastActiveLayoutName(trimmedName, appPage);
            return {
                success: true,
                message: `Layout "${trimmedName}" saved`,
                isNewLayout: true
            };
        }
    }

    deleteLayout(
        appPage: AppPage,
        layouts: IGridsterLayout[],
        index: number,
        currentLayoutName: string | undefined,
    ): { success: boolean; message: string; shouldLoadDefault: boolean; layoutName?: string } {
        if (index < 0 || index >= layouts.length) {
            return {
                success: false,
                message: 'Invalid layout index',
                shouldLoadDefault: false
            };
        }

        const layout = layouts[index];

        if (layout.name === 'Default') {
            return {
                success: false,
                message: 'Cannot delete the Default layout',
                shouldLoadDefault: false
            };
        }

        layouts.splice(index, 1);
        this.saveLayoutsToStorage(appPage, layouts);

        const shouldLoadDefault = currentLayoutName === layout.name;

        return {
            success: true,
            message: `Layout "${layout.name}" deleted`,
            shouldLoadDefault,
            layoutName: layout.name
        };
    }

    syncVisibilityToGridsterItems(gridsterItems: IGridsterItem[], boxes: Record<string, IBox>): void {
        gridsterItems.forEach((item: IGridsterItem) => {
            const box = boxes[item.name];
            if (box) {
                item.visible = box.visible ?? false;
            }
        });
    }

    syncVisibilityToBoxes(gridsterItems: IGridsterItem[], boxes: Record<string, IBox>): void {
        gridsterItems.forEach((item: IGridsterItem) => {
            const box = boxes[item.name];
            if (box) {
                box.visible = item.visible;
            }
        });
    }

    getItemByName(gridsterItems: IGridsterItem[], name: string): IGridsterItem | undefined {
        return gridsterItems.find(item => item.name === name);
    }
}

export default GridsterLayoutService;