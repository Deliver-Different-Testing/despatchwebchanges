/** @jest-environment jest-environment-jsdom */
/**
 * Tests for DashboardSettingsDialogService
 * Verifies the default-layout check behind the Customize Panels dialog, and
 * that the island's stylesheet is loaded alongside its script.
 */

jest.mock('angular', () => ({
    default: {module: jest.fn(() => ({}))},
    __esModule: true,
}));

import { AppPage } from "../../../enums/app-pages.enum";
import DashboardSettingsDialogService from "./dashboard-settings-dialog.service";
import isDefaultLayout from "../../../functions/isDefaultLayout";

describe('isDefaultLayout function', () => {
    it('should return true for "Default" layout', () => {
        expect(isDefaultLayout('Default')).toBe(true);
    });

    it('should return true for undefined layout', () => {
        expect(isDefaultLayout(undefined)).toBe(true);
    });

    it('should return true for empty string layout', () => {
        expect(isDefaultLayout('')).toBe(true);
    });

    it('should return false for custom layout names', () => {
        expect(isDefaultLayout('MyCustomLayout')).toBe(false);
        expect(isDefaultLayout('Custom')).toBe(false);
        expect(isDefaultLayout('Layout1')).toBe(false);
    });

    it('should be case-sensitive', () => {
        expect(isDefaultLayout('default')).toBe(false);
        expect(isDefaultLayout('DEFAULT')).toBe(false);
    });
});

/**
 * The island's stylesheet is only fetched if the loader lists it, and a missing
 * one fails silently — the dialog just renders unstyled. routes.ts pairs them
 * through `islandFiles()`; this loader has to do the same.
 */
describe('DashboardSettingsDialogService island loading', () => {
    const createService = (manifest: Record<string, string>) => {
        const $ocLazyLoad = {load: jest.fn().mockResolvedValue(undefined)};
        const $http = {get: jest.fn().mockResolvedValue({data: manifest})};
        const service = new DashboardSettingsDialogService($ocLazyLoad as any, $http as any);
        return {service, $ocLazyLoad};
    };

    /** The service rethrows once the window global is still missing, which is expected here. */
    const open = (service: DashboardSettingsDialogService) =>
        service.openSettingsDialog({} as MouseEvent, AppPage.Dispatch).catch(() => {});

    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation();
        jest.spyOn(console, 'error').mockImplementation();
        delete (window as any).React;
        delete (window as any).ReactDashboardSettingsDialog;
    });

    afterEach(() => jest.restoreAllMocks());

    it('loads the stylesheet alongside the script when the manifest has one', async () => {
        const {service, $ocLazyLoad} = createService({
            'vendor-react.js': 'vendor-react.v1.js',
            'dashboardSettingsDialogReact.js': 'dashboardSettingsDialogReact.a1.js',
            'dashboardSettingsDialogReact.css': 'dashboardSettingsDialogReact.a2.css',
        });

        await open(service);

        expect($ocLazyLoad.load).toHaveBeenCalledWith({
            name: 'uDispatch.dashboardSettingsDialogReact',
            files: [
                'dist/dashboardSettingsDialogReact.a1.js',
                'dist/dashboardSettingsDialogReact.a2.css',
            ],
        });
    });

    it('loads the script alone when the build emitted no stylesheet', async () => {
        const {service, $ocLazyLoad} = createService({
            'vendor-react.js': 'vendor-react.v1.js',
            'dashboardSettingsDialogReact.js': 'dashboardSettingsDialogReact.a1.js',
        });

        await open(service);

        expect($ocLazyLoad.load).toHaveBeenCalledWith({
            name: 'uDispatch.dashboardSettingsDialogReact',
            files: ['dist/dashboardSettingsDialogReact.a1.js'],
        });
    });
});
