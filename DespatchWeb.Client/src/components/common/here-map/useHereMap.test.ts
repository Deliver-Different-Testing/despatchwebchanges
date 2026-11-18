import {renderHook, waitFor} from '@testing-library/react';
import {useHereMap} from './useHereMap';
import * as utils from './hereMapUtils';
import type {HereMapConfig} from './HereMap.types';

vi.mock('../../../utils/loadHereSdk', () => ({loadHereSdk: () => Promise.resolve()}));
vi.mock('./hereMapUtils', async (importOriginal) => {
    const actual = await importOriginal<typeof import('./hereMapUtils')>();
    return {
        ...actual,
        initPlatform: vi.fn(() => ({})),
        createMap: vi.fn(() => ({
            map: {dispose: vi.fn(), getViewPort: () => ({resize: vi.fn()}), addObject: vi.fn(), removeObject: vi.fn()},
            ui: {removeControl: vi.fn()},
            defaultLayers: {},
        })),
        resizeMapPreserveView: vi.fn(),
    };
});

describe('useHereMap', () => {
    it('keeps the map when a re-render passes equal credentials in a new object', async () => {
        const config = {} as HereMapConfig;
        const {rerender} = renderHook(
            ({apiKey}: {apiKey: string}) => useHereMap({mapId: 'm', credentials: {apiKey}, config}),
            {initialProps: {apiKey: 'k'}},
        );
        await waitFor(() => expect(utils.createMap).toHaveBeenCalledTimes(1));

        rerender({apiKey: 'k'});
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(utils.createMap).toHaveBeenCalledTimes(1);
    });
});
