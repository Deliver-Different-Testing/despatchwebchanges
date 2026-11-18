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

    it('redraws the job on the rebuilt map when the API key changes', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const config = {job: {id: 1}} as unknown as HereMapConfig;
        // A pickup-less job stops showJobOnMap at this warning, once it has a live map to draw on.
        const drawOrders = () => warn.mock.calls
            .map(([msg], i) => (msg === 'Job missing valid pickup coordinates' ? warn.mock.invocationCallOrder[i] : -1))
            .filter(order => order >= 0);
        const {rerender} = renderHook(
            ({apiKey}: {apiKey: string}) => useHereMap({mapId: 'm', credentials: {apiKey}, config}),
            {initialProps: {apiKey: 'k1'}},
        );
        await waitFor(() => expect(drawOrders()).toHaveLength(1));
        const mapsBefore = vi.mocked(utils.createMap).mock.calls.length;

        rerender({apiKey: 'k2'});

        await waitFor(() => expect(utils.createMap).toHaveBeenCalledTimes(mapsBefore + 1));
        const rebuiltAt = vi.mocked(utils.createMap).mock.invocationCallOrder.at(-1)!;
        await waitFor(() => expect(drawOrders().some(order => order > rebuiltAt)).toBe(true));
        warn.mockRestore();
    });
});
