/**
 * The <job-detail-widget> bridge is how the classic AngularJS pages and Nationwide
 * mount the React job-details island. It used to lazy-load only `jobDetailsReact.js`,
 * so every CSS module inside that island was silently missing on those pages — the
 * stylesheet is only fetched if the loader lists it, and a missing one fails quietly:
 * the panel just renders unstyled. `routes.ts` pairs them through `islandFiles()`;
 * these tests pin that this loader does the same.
 */

import JobDetailComponent from './job-details.component';

type LazyLoadArg = string | {name: string; files: string[]};

describe('job-details bridge island loading', () => {
    let mockOcLazyLoad: {load: jest.Mock};
    let mockHttp: {get: jest.Mock};
    let controller: any;

    const makeController = () => {
        // ctor order: toastrService, appConfig, $element, $scope, $ocLazyLoad, $http, $rootScope
        return new (JobDetailComponent.controller as any)(
            {showErrorToast: jest.fn()},
            {US_Customer: false},
            [document.createElement('div')],
            {$applyAsync: jest.fn(), $on: jest.fn()},
            mockOcLazyLoad,
            mockHttp,
            {$broadcast: jest.fn()},
        );
    };

    beforeEach(() => {
        mockOcLazyLoad = {load: jest.fn().mockResolvedValue(undefined)};
        mockHttp = {get: jest.fn()};
        delete (window as any).React;
        (window as any).ReactJobDetails = {mount: jest.fn(), unmount: jest.fn()};
    });

    afterEach(() => {
        delete (window as any).React;
        delete (window as any).ReactJobDetails;
    });

    const islandCall = (): {name: string; files: string[]} | undefined =>
        mockOcLazyLoad.load.mock.calls
            .map((c: [LazyLoadArg]) => c[0])
            .find((a: LazyLoadArg): a is {name: string; files: string[]} =>
                typeof a === 'object' && a.name === 'uDispatch.jobDetailsReact');

    it('loads the island stylesheet alongside the script when the manifest has one', async () => {
        mockHttp.get.mockResolvedValue({
            data: {
                'vendor-react.js': 'vendor-react.v1.js',
                'jobDetailsReact.js': 'jobDetailsReact.jd2.js',
                'jobDetailsReact.css': 'jobDetailsReact.jd3.css',
            },
        });

        controller = makeController();
        await controller.doLoad().catch(() => {});

        expect(islandCall()).toEqual({
            name: 'uDispatch.jobDetailsReact',
            files: ['dist/jobDetailsReact.jd2.js', 'dist/jobDetailsReact.jd3.css'],
        });
    });

    it('loads the script alone when the build emitted no stylesheet', async () => {
        mockHttp.get.mockResolvedValue({
            data: {
                'vendor-react.js': 'vendor-react.v1.js',
                'jobDetailsReact.js': 'jobDetailsReact.jd2.js',
            },
        });

        controller = makeController();
        await controller.doLoad().catch(() => {});

        expect(islandCall()).toEqual({
            name: 'uDispatch.jobDetailsReact',
            files: ['dist/jobDetailsReact.jd2.js'],
        });
    });

    it('keeps the stylesheet in the fallback manifest used when manifest.json fails', async () => {
        mockHttp.get.mockRejectedValue(new Error('offline'));

        controller = makeController();
        await controller.doLoad().catch(() => {});

        expect(islandCall()).toEqual({
            name: 'uDispatch.jobDetailsReact',
            files: ['dist/jobDetailsReact.js', 'dist/jobDetailsReact.css'],
        });
    });
});
